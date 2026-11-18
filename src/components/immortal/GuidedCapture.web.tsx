import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { FormatKey } from '../../domain/types';
import type { VideoCandidate } from '../../domain/video';
import { MAX_VIDEO_BYTES, readWebVideoDuration } from '../../domain/video';
import { ActionButton, InlineMessage } from './AttemptFormParts';
import { COLORS } from '../../theme';
import { DuelPoseJudge, type PoseFeedback } from '../../live/duelPoseJudge.web';

type Props={formatKey?:FormatKey;maxSeconds:number;onCaptured:(v:VideoCandidate)=>void;onCancel:()=>void};
type Phase='idle'|'opening'|'ready'|'countdown'|'recording'|'saving';

const COUNTDOWN_SECONDS=5;
const PUSHUP_SECONDS=60;

/**
 * Capture guidée : l'analyse de posture tourne sur l'appareil (MediaPipe) pour aider à se placer
 * et montrer en direct si chaque répétition est valide. C'est une aide : le score officiel reste
 * décidé par la modération (IA puis humain si doute).
 */
export default function GuidedCapture({formatKey,maxSeconds,onCaptured,onCancel}:Props){
  const video=useRef<HTMLVideoElement|null>(null);
  const canvas=useRef<HTMLCanvasElement|null>(null);
  const stream=useRef<MediaStream|null>(null);
  const recorder=useRef<MediaRecorder|null>(null);
  const judge=useRef<DuelPoseJudge|null>(null);
  const started=useRef(0);
  const alive=useRef(true);
  const interrupted=useRef(false);
  const timer=useRef<ReturnType<typeof setInterval>|null>(null);
  const countdownTimer=useRef<ReturnType<typeof setInterval>|null>(null);
  const repsAtStart=useRef(0);
  const repsTotal=useRef(0);
  const recordingRef=useRef(false);
  const [phase,setPhase]=useState<Phase>('idle');
  const [problem,setProblem]=useState<string|null>(null);
  const [elapsed,setElapsed]=useState(0);
  const [countdown,setCountdown]=useState(COUNTDOWN_SECONDS);
  const [feedback,setFeedback]=useState<PoseFeedback|null>(null);
  const [reps,setReps]=useState(0);
  const [flash,setFlash]=useState<'good'|'bad'|null>(null);
  const [code]=useState(()=>{const n=new Uint32Array(1);crypto.getRandomValues(n);return String(1000+n[0]%9000);});
  const pullups=formatKey==='pullups_max';
  const limitSeconds=pullups?maxSeconds:Math.min(maxSeconds,PUSHUP_SECONDS+1);
  const placed=!!feedback&&!['loading','setup','not-visible','error'].includes(feedback.kind);
  const poseUnavailable=feedback?.kind==='error';

  const pulse=(kind:'good'|'bad')=>{setFlash(kind);setTimeout(()=>{if(alive.current)setFlash(null);},450);};
  const release=()=>{
    judge.current?.dispose();judge.current=null;
    stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;
    if(video.current)video.current.srcObject=null;
  };
  useEffect(()=>{
    alive.current=true;
    const hidden=()=>{if(document.hidden&&recorder.current?.state==='recording'){interrupted.current=true;recorder.current.stop();}};
    document.addEventListener('visibilitychange',hidden);
    return()=>{alive.current=false;interrupted.current=true;document.removeEventListener('visibilitychange',hidden);if(timer.current)clearInterval(timer.current);if(countdownTimer.current)clearInterval(countdownTimer.current);if(recorder.current?.state==='recording')recorder.current.stop();release();};
  },[]);

  const onFeedback=(next:PoseFeedback)=>{
    if(!alive.current)return;
    setFeedback(next);
    // Répétition refusée pendant l'enregistrement : flash rouge.
    if(recordingRef.current&&next.kind==='correct'&&next.message.startsWith('Pas comptée'))pulse('bad');
  };

  const open=async()=>{
    setProblem(null);setPhase('opening');
    try{
      if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined')throw new Error('unsupported');
      const media=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720},facingMode:{ideal:'environment'}},audio:true});
      if(!alive.current){media.getTracks().forEach(t=>t.stop());return;}
      stream.current=media;
      for(const track of media.getTracks())track.addEventListener('ended',()=>{if(recorder.current?.state==='recording'){interrupted.current=true;recorder.current.stop();}});
      if(video.current){video.current.srcObject=media;await video.current.play();}
      setPhase('ready');
      if(video.current&&canvas.current){
        const j=new DuelPoseJudge(video.current,canvas.current,pullups?'pullup':'pushup',0,async()=>{
          repsTotal.current+=1;
          if(recordingRef.current){setReps(repsTotal.current-repsAtStart.current);pulse('good');}
          return true;
        },onFeedback);
        judge.current=j;
        void j.start();
      }
    }catch(error){if(!alive.current)return;release();setPhase('idle');setProblem(error instanceof Error&&error.message==='unsupported'?'Cette capture nécessite un navigateur compatible et une connexion sécurisée. Tu peux importer une vidéo.':'Caméra ou microphone indisponible. Vérifie les autorisations puis réessaie, ou importe une vidéo.');}
  };

  const record=()=>{
    if(!stream.current)return;
    setProblem(null);interrupted.current=false;
    const types=['video/webm;codecs=vp8,opus','video/webm','video/mp4'];
    const mime=types.find(t=>MediaRecorder.isTypeSupported(t));
    if(!mime){setProblem('Le navigateur ne propose pas de format vidéo compatible. Importe une vidéo MP4, MOV ou WebM.');setPhase('ready');return;}
    try{
      const chunks:Blob[]=[];let total=0;
      const rec=new MediaRecorder(stream.current,{mimeType:mime,videoBitsPerSecond:1500000});recorder.current=rec;
      rec.ondataavailable=e=>{if(e.data.size){chunks.push(e.data);total+=e.data.size;if(total>MAX_VIDEO_BYTES){interrupted.current=true;if(rec.state==='recording')rec.stop();}}};
      rec.onerror=()=>{interrupted.current=true;if(rec.state==='recording')rec.stop();};
      rec.onstop=async()=>{
        recordingRef.current=false;
        if(timer.current){clearInterval(timer.current);timer.current=null;}
        const duration=(performance.now()-started.current)/1000;
        const liveReps=repsTotal.current-repsAtStart.current;
        release();
        if(!alive.current)return;
        setPhase('saving');
        if(interrupted.current){setPhase('idle');setProblem('Capture interrompue ou trop volumineuse : recommence sans quitter cet écran. Aucun fichier envoyé.');return;}
        const blob=new Blob(chunks,{type:rec.mimeType.split(';')[0]});
        if(!blob.size||duration<3){setPhase('idle');setProblem('Filme au moins 3 secondes, puis ta performance.');return;}
        const uri=URL.createObjectURL(blob);
        try{
          const measured=await readWebVideoDuration(uri);
          if(!alive.current){URL.revokeObjectURL(uri);return;}
          onCaptured({uri,mimeType:blob.type,fileSize:blob.size,durationSeconds:measured,source:'guided',sessionCode:code,liveReps:poseUnavailable?null:liveReps});
        }catch{URL.revokeObjectURL(uri);if(alive.current){setPhase('idle');setProblem('Le fichier enregistré est illisible. Recommence la capture.');}}
      };
      started.current=performance.now();
      repsAtStart.current=repsTotal.current;recordingRef.current=true;setReps(0);
      rec.start(250);setElapsed(0);setPhase('recording');
      timer.current=setInterval(()=>{const seconds=(performance.now()-started.current)/1000;setElapsed(seconds);if(seconds>=limitSeconds-0.3&&rec.state==='recording'){setPhase('saving');rec.stop();}},100);
    }catch{setPhase('ready');setProblem('Impossible de démarrer l’enregistrement. Réessaie ou importe une vidéo.');}
  };

  // Compte à rebours de 5 s pour se mettre en place, puis l'enregistrement démarre seul.
  const startCountdown=()=>{
    if(phase!=='ready')return;
    setCountdown(COUNTDOWN_SECONDS);setPhase('countdown');
    let left=COUNTDOWN_SECONDS;
    countdownTimer.current=setInterval(()=>{
      left-=1;
      if(!alive.current)return;
      if(left<=0){if(countdownTimer.current)clearInterval(countdownTimer.current);countdownTimer.current=null;record();}
      else setCountdown(left);
    },1000);
  };
  const cancelCountdown=()=>{if(countdownTimer.current)clearInterval(countdownTimer.current);countdownTimer.current=null;setPhase('ready');};
  const stop=()=>{if(recorder.current?.state==='recording'){setPhase('saving');recorder.current.stop();}};

  const live=phase==='ready'||phase==='countdown'||phase==='recording';
  const remaining=Math.max(0,limitSeconds-1-elapsed);
  const statusColor=poseUnavailable?'#FBBF24':placed?'#34D399':'#EF6877';
  const statusText=poseUnavailable?'Analyse de posture indisponible : place-toi à l’aide du cadre.'
    :!feedback||feedback.kind==='loading'?'Chargement de l’analyse de posture…'
    :placed?(phase==='ready'?'Bien placé ✔':feedback.message):feedback.message;

  return <View style={styles.box}>
    <View style={{gap:5}}><Text style={styles.title}>Filmer avec le coach</Text><Text style={styles.help}>Le coach t’aide à te placer et montre chaque répétition en direct : vert = valide, rouge = pas comptée. Le score officiel reste vérifié par la modération.</Text></View>
    <View style={styles.code}><Text style={{color:'#F0D786',fontWeight:'800'}}>Séance {code} · {phase==='recording'?(pullups?`${elapsed.toFixed(1)} s`:`${Math.ceil(remaining)} s restantes`):phase==='countdown'?'prépare-toi':'préparation'}</Text></View>
    <View style={[styles.preview,flash==='good'?styles.flashGood:flash==='bad'?styles.flashBad:null]}>
      {React.createElement('video',{ref:video,autoPlay:true,muted:true,playsInline:true,'aria-label':'Aperçu caméra de la performance',style:{width:'100%',height:360,objectFit:'cover',background:'#050507',display:'block'}})}
      {React.createElement('canvas',{ref:canvas,style:{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:pullups&&live?'auto':'none',cursor:pullups?'crosshair':'default'}})}
      {live&&!placed?<View pointerEvents="none" style={styles.frameGuide}><Text style={styles.frameText}>{pullups?'Barre, mains, visage et pieds dans le cadre':'De profil · mains, épaules, bassin et pieds dans le cadre'}</Text></View>:null}
      {phase==='recording'?<View pointerEvents="none" style={styles.repBadge}><Text style={styles.repNumber}>{reps}</Text><Text style={styles.repLabel}>valides</Text></View>:null}
      {phase==='countdown'?<View pointerEvents="none" style={styles.countdown}><Text style={styles.countdownNumber}>{countdown}</Text><Text style={styles.countdownLabel}>Mets-toi en position</Text></View>:null}
      {flash?<View pointerEvents="none" style={[styles.flashTag,{backgroundColor:flash==='good'?'#059669E6':'#DC2626E6'}]}><Text style={styles.flashText}>{flash==='good'?'✔ VALIDE':'✖ PAS COMPTÉE'}</Text></View>:null}
    </View>
    {live?<View style={[styles.status,{borderColor:statusColor}]}><View style={[styles.dot,{backgroundColor:statusColor}]}/><Text style={[styles.statusText,{color:statusColor}]}>{statusText}</Text></View>:null}
    {pullups&&live?<Text style={styles.help}>Touche l’image à la hauteur de la barre pour placer le repère jaune.</Text>:null}
    <Text style={styles.help}>{pullups?'Recule la caméra : barre, mains, menton et pieds visibles. Une répétition = menton au-dessus de la barre ET retour bras tendus, sans élan.':'Pose la caméra au sol, de profil, à 2–3 m. Une pompe = poitrine près du sol (coudes à 90°) puis bras tendus, corps aligné. Le chrono de 60 s démarre après le compte à rebours.'}</Text>
    {problem?<InlineMessage tone="error">{problem}</InlineMessage>:null}
    {phase==='idle'?<ActionButton label="Autoriser caméra et microphone" onPress={open}/>
      :phase==='opening'?<ActionButton label="Ouverture de la caméra" onPress={()=>{}} disabled loading/>
      :phase==='ready'?<ActionButton label={placed||poseUnavailable?`Démarrer (compte à rebours ${COUNTDOWN_SECONDS} s)`:'Place-toi dans le cadre…'} onPress={startCountdown} disabled={!placed&&!poseUnavailable}/>
      :phase==='countdown'?<ActionButton label="Annuler le départ" variant="ghost" onPress={cancelCountdown}/>
      :<ActionButton label={phase==='saving'?'Préparation de la vidéo':'Terminer la capture'} onPress={stop} disabled={phase==='saving'} loading={phase==='saving'}/>}
    {phase==='ready'&&!placed&&!poseUnavailable?<Pressable onPress={startCountdown} accessibilityRole="button"><Text style={[styles.help,{textDecorationLine:'underline',textAlign:'center'}]}>Démarrer quand même</Text></Pressable>:null}
    <ActionButton label="Annuler la capture" variant="ghost" onPress={onCancel}/>
    <Text style={styles.help}>Reste sur cet écran : quitter l’onglet invalide la capture. L’analyse se fait sur ton appareil ; rien n’est envoyé avant ta confirmation dans le formulaire.</Text>
  </View>;
}
const styles=StyleSheet.create({
  box:{padding:16,gap:13,borderWidth:1,borderColor:'#D4AF3750',borderRadius:18,backgroundColor:COLORS.card},
  title:{color:COLORS.text,fontSize:19,fontWeight:'800'},
  help:{color:COLORS.textMuted,fontSize:12,lineHeight:18},
  preview:{position:'relative',overflow:'hidden',borderRadius:12,backgroundColor:'#050507',borderWidth:3,borderColor:'transparent'},
  flashGood:{borderColor:'#10B981'},
  flashBad:{borderColor:'#EF4444'},
  frameGuide:{position:'absolute',left:'6%',right:'6%',top:'8%',bottom:'8%',borderWidth:2,borderStyle:'dashed',borderColor:'#F0D786AA',borderRadius:14,justifyContent:'flex-end',alignItems:'center',padding:8},
  frameText:{color:'#F0D786',fontSize:11,fontWeight:'800',backgroundColor:'#050507C9',paddingHorizontal:8,paddingVertical:4,borderRadius:6,textAlign:'center'},
  repBadge:{position:'absolute',top:10,right:10,backgroundColor:'#050507D9',borderRadius:12,paddingHorizontal:14,paddingVertical:6,alignItems:'center',borderWidth:1,borderColor:'#D4AF37'},
  repNumber:{color:'#F0D786',fontSize:30,fontWeight:'900',lineHeight:34},
  repLabel:{color:COLORS.textMuted,fontSize:10,fontWeight:'800',textTransform:'uppercase'},
  countdown:{position:'absolute',top:0,left:0,right:0,bottom:0,alignItems:'center',justifyContent:'center',backgroundColor:'#050507A6'},
  countdownNumber:{color:'#F0D786',fontSize:96,fontWeight:'900',lineHeight:100},
  countdownLabel:{color:'#FFFFFF',fontSize:15,fontWeight:'800'},
  flashTag:{position:'absolute',bottom:12,alignSelf:'center',left:'25%',right:'25%',borderRadius:10,paddingVertical:8,alignItems:'center'},
  flashText:{color:'#FFFFFF',fontSize:16,fontWeight:'900',letterSpacing:0.5},
  status:{flexDirection:'row',alignItems:'center',gap:10,padding:12,borderWidth:1,borderRadius:10,backgroundColor:'#050507'},
  dot:{width:10,height:10,borderRadius:5},
  statusText:{flex:1,fontSize:13,fontWeight:'800'},
  code:{padding:10,backgroundColor:'#050507BB',borderRadius:8},
});

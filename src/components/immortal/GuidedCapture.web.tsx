import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { FormatKey } from '../../domain/types';
import type { VideoCandidate } from '../../services/video';
import { MAX_VIDEO_BYTES, readWebVideoDuration } from '../../services/video';
import { ActionButton, InlineMessage } from './AttemptFormParts';
import { COLORS } from '../../theme';

type Props={formatKey?:FormatKey;maxSeconds:number;onCaptured:(v:VideoCandidate)=>void;onCancel:()=>void};

/** Repères manuels de cadrage, jamais présentés comme une mesure anatomique ou une validation IA. */
export default function GuidedCapture({formatKey,maxSeconds,onCaptured,onCancel}:Props){
  const video=useRef<HTMLVideoElement|null>(null);
  const stream=useRef<MediaStream|null>(null);
  const recorder=useRef<MediaRecorder|null>(null);
  const started=useRef(0);
  const alive=useRef(true);
  const interrupted=useRef(false);
  const timer=useRef<ReturnType<typeof setInterval>|null>(null);
  const [phase,setPhase]=useState<'idle'|'opening'|'ready'|'recording'|'saving'>('idle');
  const [problem,setProblem]=useState<string|null>(null);
  const [elapsed,setElapsed]=useState(0);
  const [bar,setBar]=useState(26);
  const [checked,setChecked]=useState(false);
  const [code]=useState(()=>{const n=new Uint32Array(1);crypto.getRandomValues(n);return String(1000+n[0]%9000);});
  const pullups=formatKey==='pullups_max';
  const release=()=>{stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;if(video.current)video.current.srcObject=null;};
  useEffect(()=>{
    alive.current=true;
    const hidden=()=>{if(document.hidden&&recorder.current?.state==='recording'){interrupted.current=true;recorder.current.stop();}};
    document.addEventListener('visibilitychange',hidden);
    return()=>{alive.current=false;interrupted.current=true;document.removeEventListener('visibilitychange',hidden);if(timer.current)clearInterval(timer.current);if(recorder.current?.state==='recording')recorder.current.stop();release();};
  },[]);
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
    }catch(error){if(!alive.current)return;release();setPhase('idle');setProblem(error instanceof Error&&error.message==='unsupported'?'Cette capture nécessite un navigateur compatible et une connexion sécurisée (ou localhost). Tu peux importer une vidéo.':'Caméra ou microphone indisponible. Vérifie les autorisations puis réessaie, ou importe une vidéo.');}
  };
  const record=()=>{
    if(phase!=='ready'||!checked||!stream.current)return;
    setProblem(null);interrupted.current=false;
    const types=['video/webm;codecs=vp8,opus','video/webm','video/mp4'];
    const mime=types.find(t=>MediaRecorder.isTypeSupported(t));
    if(!mime){setProblem('Le navigateur ne propose pas de format vidéo compatible. Importe une vidéo MP4, MOV ou WebM.');return;}
    try{
      const chunks:Blob[]=[];let total=0;
      const rec=new MediaRecorder(stream.current,{mimeType:mime,videoBitsPerSecond:1500000});recorder.current=rec;
      rec.ondataavailable=e=>{if(e.data.size){chunks.push(e.data);total+=e.data.size;if(total>MAX_VIDEO_BYTES){interrupted.current=true;if(rec.state==='recording')rec.stop();}}};
      rec.onerror=()=>{interrupted.current=true;if(rec.state==='recording')rec.stop();};
      rec.onstop=async()=>{
        if(timer.current){clearInterval(timer.current);timer.current=null;}
        const duration=(performance.now()-started.current)/1000;
        release();
        if(!alive.current)return;
        setPhase('saving');
        if(interrupted.current){setPhase('idle');setProblem('Capture interrompue ou trop volumineuse : recommence sans quitter cet écran. Aucun fichier envoyé.');return;}
        const blob=new Blob(chunks,{type:rec.mimeType.split(';')[0]});
        if(!blob.size||duration<3){setPhase('idle');setProblem('Filme au moins 3 secondes avec le code annoncé, puis ta performance.');return;}
        const uri=URL.createObjectURL(blob);
        try{
          const measured=await readWebVideoDuration(uri);
          if(!alive.current){URL.revokeObjectURL(uri);return;}
          onCaptured({uri,mimeType:blob.type,fileSize:blob.size,durationSeconds:measured,source:'guided',sessionCode:code});
        }catch{URL.revokeObjectURL(uri);if(alive.current){setPhase('idle');setProblem('Le fichier enregistré est illisible. Recommence la capture.');}}
      };
      started.current=performance.now();rec.start(250);setElapsed(0);setPhase('recording');
      timer.current=setInterval(()=>{const seconds=(performance.now()-started.current)/1000;setElapsed(seconds);if(seconds>=maxSeconds-0.3&&rec.state==='recording'){setPhase('saving');rec.stop();}},100);
    }catch{setProblem('Impossible de démarrer l’enregistrement. Réessaie ou importe une vidéo.');}
  };
  const stop=()=>{if(recorder.current?.state==='recording'){setPhase('saving');recorder.current.stop();}};
  return <View style={styles.box}>
    <View style={{gap:5}}><Text style={styles.title}>Filmer avec les repères</Text><Text style={styles.help}>Repères de cadrage manuels. Aucun mouvement n’est détecté automatiquement.</Text></View>
    <View style={styles.code}><Text style={{color:'#F0D786',fontWeight:'800'}}>Séance {code} · {phase==='recording'?`${elapsed.toFixed(1)} s`:'préparation'}</Text></View>
    <View style={styles.preview}>
      {React.createElement('video',{ref:video,autoPlay:true,muted:true,playsInline:true,'aria-label':'Aperçu caméra de la performance',style:{width:'100%',height:320,objectFit:'contain',background:'#050507'}})}
      {(phase==='ready'||phase==='recording')?<View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={[styles.line,{top:`${pullups?bar:48}%`,backgroundColor:'#EF6877'}]}><Text style={[styles.tag,{color:'#FFB2BA'}]}>{pullups?'Aligner ici la barre':'Corps entier · vue de profil'}</Text></View>
        <View style={[styles.line,{top:`${pullups?Math.max(6,bar-3):72}%`,backgroundColor:'#49D6B0'}]}><Text style={[styles.tag,{color:'#9BE8CA',top:-24}]}>{pullups?'Zone haute : menton au-dessus · indicatif':'En bas : amplitude à vérifier'}</Text></View>
      </View>:null}
    </View>
    <Text style={styles.help}>{pullups?'Recule la caméra : barre, mains, menton et pieds doivent rester visibles. Une répétition nécessite le menton au-dessus de la barre ET le retour bras tendus, sans élan.':'Pose la caméra de profil : mains, épaules, bassin et pieds visibles. La modération vérifie la descente, l’alignement du corps et le retour bras tendus.'}</Text>
    {pullups&&phase==='ready'?<View style={styles.row}><ActionButton label="Repère plus haut" variant="ghost" fullWidth={false} onPress={()=>setBar(v=>Math.max(15,v-2))}/><ActionButton label="Repère plus bas" variant="ghost" fullWidth={false} onPress={()=>setBar(v=>Math.min(50,v+2))}/></View>:null}
    <Text style={styles.help}>Au début de la vidéo, annonce « IMMORTAL {code} » à voix haute. Ce code local aide la relecture, sans certifier l’authenticité de la vidéo.</Text>
    {phase==='ready'?<Pressable accessibilityRole="checkbox" accessibilityState={{checked}} onPress={()=>setChecked(v=>!v)} style={styles.check}><Text style={{color:COLORS.text,fontSize:13}}>{checked?'☑':'☐'} Mon corps entier et les repères utiles sont visibles.</Text></Pressable>:null}
    {problem?<InlineMessage tone="error">{problem}</InlineMessage>:null}
    {phase==='idle'?<ActionButton label="Autoriser caméra et microphone" onPress={open}/>:phase==='opening'?<ActionButton label="Ouverture de la caméra" onPress={()=>{}} disabled loading/>:phase==='ready'?<ActionButton label="Démarrer la capture" onPress={record} disabled={!checked}/>:<ActionButton label={phase==='saving'?'Préparation de la vidéo':'Terminer la capture'} onPress={stop} disabled={phase==='saving'} loading={phase==='saving'}/>}
    <ActionButton label="Annuler la capture" variant="ghost" onPress={onCancel}/>
    <Text style={styles.help}>Reste sur cet écran. La capture est continue, sans pause ; quitter l’onglet l’invalide. Rien n’est envoyé avant ta confirmation dans le formulaire.</Text>
  </View>;
}
const styles=StyleSheet.create({box:{padding:16,gap:13,borderWidth:1,borderColor:'#D4AF3750',borderRadius:18,backgroundColor:COLORS.card},title:{color:COLORS.text,fontSize:19,fontWeight:'800'},help:{color:COLORS.textMuted,fontSize:12,lineHeight:18},preview:{position:'relative',overflow:'hidden',borderRadius:12,backgroundColor:'#050507'},line:{position:'absolute',left:12,right:12,height:2},tag:{fontSize:10,fontWeight:'800',backgroundColor:'#050507C9',alignSelf:'flex-start',padding:4,top:4},code:{padding:10,backgroundColor:'#050507BB',borderRadius:8},row:{flexDirection:'row',flexWrap:'wrap',gap:8},check:{padding:12,minHeight:44,borderWidth:1,borderColor:COLORS.border,borderRadius:10}});

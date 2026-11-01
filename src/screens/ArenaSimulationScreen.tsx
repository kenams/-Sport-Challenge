import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import ScreenContainer from '../components/ScreenContainer';
import { COLORS } from '../theme';
import { ArenaAudio, soundCues } from '../simulation/audio';
import { addMyComment, requestRematch, beginRematch, startPresenceCheck, arriveInTime, advanceClock, formatCountdown, advanceSimulation, cheer, createSimulation, dethrone, ranks, support, type SimFormat, type SimPlayer } from '../simulation/arena';

const YOU:SimPlayer={id:'you',name:'Toi',city:'Au bord du terrain',country:'',color:'#D4AF37',skin:'#DDA680',hair:'#302631',scores:{pushups:0,pullups:0}};

/** Portraits dessinés dans l'interface : aucun service externe, aucune photo attribuée à un faux compte. */
function Avatar({player,size=46}:{player:SimPlayer;size?:number}) {
  const s=size/64;
  const longHair=['lea','sarah','ines'].includes(player.id);
  return <View accessibilityLabel={`Avatar illustré de ${player.name}`} style={{width:size,height:size,borderRadius:size/2,overflow:'hidden',backgroundColor:player.color+'24',borderWidth:1,borderColor:player.color+'70'}}>
    <View style={{position:'absolute',width:50*s,height:35*s,left:7*s,top:44*s,borderRadius:22*s,backgroundColor:player.color}} />
    <View style={{position:'absolute',width:12*s,height:16*s,left:26*s,top:35*s,backgroundColor:player.skin,borderRadius:5*s}} />
    {longHair ? <View style={{position:'absolute',width:40*s,height:45*s,left:12*s,top:8*s,borderTopLeftRadius:20*s,borderTopRightRadius:20*s,borderBottomLeftRadius:8*s,borderBottomRightRadius:8*s,backgroundColor:player.hair}}/> : null}
    <View style={{position:'absolute',width:34*s,height:39*s,left:15*s,top:10*s,borderRadius:16*s,backgroundColor:player.skin}}>
      <View style={{position:'absolute',width:36*s,height:15*s,top:-3*s,left:-1*s,borderTopLeftRadius:18*s,borderTopRightRadius:18*s,borderBottomRightRadius:10*s,backgroundColor:player.hair}} />
      <View style={{position:'absolute',width:3*s,height:4*s,left:8*s,top:19*s,borderRadius:2*s,backgroundColor:'#30242B'}} />
      <View style={{position:'absolute',width:3*s,height:4*s,right:8*s,top:19*s,borderRadius:2*s,backgroundColor:'#30242B'}} />
      <View style={{position:'absolute',width:11*s,height:5*s,left:12*s,top:28*s,borderBottomLeftRadius:8*s,borderBottomRightRadius:8*s,backgroundColor:'#FFF4E6'}} />
    </View>
  </View>;
}
/** Jauge d'élan visuelle : une répétition monte la barre, sans modifier le score. */
function EnergyAvatar({player,count,size}:{player:SimPlayer;count:number;size:number}) {
  const progress=Math.min(1,count/30);
  const color=progress<0.35?player.color:progress<0.65?'#F0CA5A':progress<0.85?'#FF9B4A':'#FF657D';
  const level=useRef(new Animated.Value(progress)).current;
  const previousLevel=useRef(progress);
  const flash=useRef(new Animated.Value(0)).current;
  const wasFull=useRef(progress>=1);
  const [reduced,setReduced]=useState(false);
  useEffect(()=>{
    let alive=true;
    AccessibilityInfo.isReduceMotionEnabled().then(v=>{if(alive)setReduced(v);}).catch(()=>{});
    const sub=AccessibilityInfo.addEventListener('reduceMotionChanged',setReduced);
    return()=>{alive=false;sub.remove();};
  },[]);
  useEffect(()=>{
    const decreased=progress<previousLevel.current;
    previousLevel.current=progress;
    if(reduced||decreased){level.setValue(progress);return;}
    const animation=Animated.timing(level,{toValue:progress,duration:240,useNativeDriver:false});
    animation.start();return()=>animation.stop();
  },[level,progress,reduced]);
  useEffect(()=>{
    const reached=progress>=1&&!wasFull.current;
    wasFull.current=progress>=1;
    if(progress<1){flash.stopAnimation();flash.setValue(0);}
    if(!reached||reduced)return;
    const animation=Animated.sequence([
      Animated.timing(flash,{toValue:0.55,duration:180,useNativeDriver:true}),
      Animated.timing(flash,{toValue:0,duration:650,useNativeDriver:true}),
    ]);
    animation.start();return()=>animation.stop();
  },[progress,reduced,flash]);
  return <View style={{alignItems:'center',gap:7,position:'relative'}}>
    <Animated.View testID={`energy-flash-${player.id}`} pointerEvents="none" style={{position:'absolute',left:-8,right:-8,top:-8,bottom:-8,borderRadius:24,borderWidth:3,borderColor:'#FFF2AE',backgroundColor:'#FFD87322',opacity:flash}}/>
    <Text accessibilityLiveRegion="polite" style={{fontSize:10,fontWeight:'800',color:progress>=1?'#FFE197':color,letterSpacing:0.5}}>{progress>=1?'PLEIN ÉLAN ✦':progress>=0.65?'ÇA CHAUFFE':'ÉLAN'}</Text>
    <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
      <Avatar player={player} size={size}/>
      <View aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress*100)} accessibilityRole="progressbar" accessibilityLabel={`Élan de ${player.name}, effet visuel`} accessibilityValue={{min:0,max:100,now:Math.round(progress*100),text:`${count} répétitions simulées`}} style={{height:size+16,width:12,borderRadius:8,backgroundColor:'#FFFFFF0D',borderWidth:1,borderColor:color+'65',overflow:'hidden'}}>
        <Animated.View style={{position:'absolute',bottom:0,left:0,right:0,height:level.interpolate({inputRange:[0,1],outputRange:['0%','100%']}),backgroundColor:color,borderRadius:7}}/>
        {[0.25,0.5,0.75].map(mark=><View key={mark} pointerEvents="none" style={{position:'absolute',left:0,right:0,bottom:`${mark*100}%`,height:1,backgroundColor:'#0D0B16AA'}}/>)}
      </View>
    </View>
    <Text style={{fontSize:10,color:'#C6BDCF'}}>{count===0?'À toi de jouer':progress>=0.65?'Garde le rythme !':'Une de plus. Encore.'}</Text>
  </View>;
}

function FlyingHeart({id,color,onDone}:{id:number;color:string;onDone:(id:number)=>void}) {
  const rise=useRef(new Animated.Value(0)).current;
  useEffect(()=>{const animation=Animated.timing(rise,{toValue:1,duration:850,useNativeDriver:true});animation.start(({finished})=>{if(finished)onDone(id);});return()=>animation.stop();},[id,onDone,rise]);
  return <Animated.View pointerEvents="none" style={{position:'absolute',bottom:'32%',left:`${12+(id*19)%72}%`,opacity:rise.interpolate({inputRange:[0,0.65,1],outputRange:[1,1,0]}),transform:[{translateY:rise.interpolate({inputRange:[0,1],outputRange:[0,-150]})},{translateX:rise.interpolate({inputRange:[0,0.5,1],outputRange:[0,id%2?15:-15,0]})},{scale:rise.interpolate({inputRange:[0,0.2,1],outputRange:[0.6,1.4,1]})}]}}><Text style={{fontSize:30,color,fontWeight:'900'}}>♥</Text></Animated.View>;
}

function Button({label,onPress,selected=false,subtle=false,disabled=false}:{label:string;onPress:()=>void;selected?:boolean;subtle?:boolean;disabled?:boolean}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{selected,disabled}} disabled={disabled} onPress={onPress} style={({pressed})=>[styles.button,subtle?styles.subtle:null,selected?styles.selected:null,disabled?{opacity:0.4}:null,pressed?{opacity:0.75}:null]}><Text style={[styles.buttonText,subtle?{color:COLORS.text}:null]}>{label}</Text></Pressable>;
}

/** Seul le chrono se redessine à chaque image ; le jeu avance par secondes écoulées. */
function PrecisionClock({running,speed,remaining,round,resetKey,onSeconds}:{running:boolean;speed:number;remaining:number;round:number;resetKey:number;onSeconds:(n:number)=>void}) {
  const remainder=useRef(0);
  const left=useRef(remaining);
  const [displayMs,setDisplayMs]=useState(remaining*1000);
  useEffect(()=>{left.current=remaining;},[remaining,round]);
  useEffect(()=>{remainder.current=0;left.current=remaining;setDisplayMs(remaining*1000);},[resetKey]);
  useEffect(()=>{
    if(!running)return;
    let last=performance.now();
    let frame=0;
    const render=()=>{
      const now=performance.now();
      const step=advanceClock(last,remainder.current,now,speed);
      last=step.last;remainder.current=step.remainderMs;
      if(step.seconds){left.current=Math.max(0,left.current-step.seconds);onSeconds(step.seconds);}
      setDisplayMs(Math.max(0,left.current*1000-remainder.current));
      frame=requestAnimationFrame(render);
    };
    frame=requestAnimationFrame(render);
    return()=>cancelAnimationFrame(frame);
  },[running,speed,onSeconds]);
  return <Text accessibilityLabel={`Chronomètre simulé : ${formatCountdown(displayMs)}`} style={[styles.timer,{fontVariant:['tabular-nums'],fontSize:25,color:displayMs<=10000?'#FF657D':displayMs<=20000?'#F0CA5A':'#FFF7EC'}]}>{formatCountdown(displayMs)}</Text>;
}

export default function ArenaSimulationScreen({onExit}:{onExit?:()=>void}) {
  const navigation=useNavigation<any>();
  const focused=useIsFocused();
  const {width}=useWindowDimensions();
  const wide=width>=1050;
  const [state,setState]=useState(createSimulation);
  const [paused,setPaused]=useState(false);
  const [speed,setSpeed]=useState<1|3>(1);
  const [format,setFormat]=useState<SimFormat>('pushups');
  const [country,setCountry]=useState(false);
  const [panel,setPanel]=useState<'duel'|'fil'|'classement'>('duel');
  const [draft,setDraft]=useState('');
  const [hearts,setHearts]=useState<Array<{id:number;color:string}>>([]);
  const nextHeart=useRef(0);
  const [combo,setCombo]=useState(0);
  const comboTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const [reducedMotion,setReducedMotion]=useState(false);
  const removeHeart=useCallback((id:number)=>setHearts(list=>list.filter(h=>h.id!==id)),[]);
  useEffect(()=>{let alive=true;AccessibilityInfo.isReduceMotionEnabled().then(v=>{if(alive)setReducedMotion(v);}).catch(()=>{});const sub=AccessibilityInfo.addEventListener('reduceMotionChanged',setReducedMotion);return()=>{alive=false;sub.remove();if(comboTimer.current)clearTimeout(comboTimer.current);};},[]);
  const tap=(player:SimPlayer)=>{
    setState(s=>cheer(s,player.id));
    setCombo(n=>Math.min(99,n+1));
    if(comboTimer.current)clearTimeout(comboTimer.current);
    comboTimer.current=setTimeout(()=>setCombo(0),1400);
    if(!reducedMotion){const id=++nextHeart.current;setHearts(list=>[...list.slice(-11),{id,color:player.color}]);}
  };
  const audio=useRef<ArenaAudio|null>(null);
  const [soundOn,setSoundOn]=useState(false);
  const [soundError,setSoundError]=useState<string|null>(null);
  const previousSoundState=useRef(state);
  const toggleSound=async()=>{
    setSoundError(null);
    if(soundOn){await audio.current?.suspend().catch(()=>{});setSoundOn(false);return;}
    try{audio.current??=new ArenaAudio();const enabled=await audio.current.enable();setSoundOn(enabled);if(enabled)audio.current.play('start');else setSoundError('Le son n’est pas disponible dans ce navigateur.');}
    catch{setSoundError('Impossible d’activer le son. Réessaie depuis ton navigateur.');}
  };
  useEffect(()=>()=>{audio.current?.dispose().catch(()=>{});},[]);
  useEffect(()=>{
    const previous=previousSoundState.current;
    previousSoundState.current=state;
    if(!soundOn||paused||!focused)return;
    for(const cue of soundCues(previous,state))audio.current?.play(cue);
  },[state,soundOn,paused,focused]);
  const [active,setActive]=useState(AppState.currentState==='active');
  const [visible,setVisible]=useState(Platform.OS!=='web'||document.visibilityState!=='hidden');
  useEffect(()=>{const sub=AppState.addEventListener('change',s=>setActive(s==='active'));return()=>sub.remove();},[]);
  useEffect(()=>{if(Platform.OS!=='web')return;const change=()=>setVisible(document.visibilityState!=='hidden');document.addEventListener('visibilitychange',change);return()=>document.removeEventListener('visibilitychange',change);},[]);
  const [clockReset,setClockReset]=useState(0);
  const onSeconds=useCallback((count:number)=>setState(s=>{let next=s;for(let i=0;i<count;i++)next=advanceSimulation(next);return next;}),[]);
  if(!__DEV__)return <ScreenContainer><Text style={styles.muted}>La simulation est disponible uniquement en développement.</Text></ScreenContainer>;
  const board=ranks(state.players.filter(p=>!country||p.country==='France'),format);
  const a=state.players[state.duel.a],b=state.players[state.duel.b];
  const scoreA=state.duel.scoreA,scoreB=state.duel.scoreB;
  const leader=state.rematch?.phase==='rest'?'Récupération avant la revanche':state.rematch?.phase==='ready'?'Repos terminé · prêt pour la revanche':state.presence?.status==='waiting'?'En attente de présence':state.presence?.status==='forfeit'?`${state.presence.playerId===a.id?b.name:a.name} gagne par forfait`:scoreA===scoreB?'Égalité parfaite':`${scoreA>scoreB?a.name:b.name} prend l’avantage`;
  const send=()=>{if(!draft.trim())return;setState(s=>addMyComment(s,draft));setDraft('');};
  return <ScreenContainer>
    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.page}>
      <View style={styles.demoBar}>
        <View style={{flex:1,minWidth:180,gap:3}}><Text style={styles.demoTitle}>Laboratoire · simulation locale</Text><Text style={styles.demoText}>Joueurs, scores et échanges fictifs. Aucun record réel modifié.</Text></View>
        <Button subtle label={width<600?"Vrais parcours":"Retour à l’application"} onPress={()=>onExit?onExit():navigation.navigate('MainTabs',{screen:'Defis'})} />
      </View>
      <View style={styles.intro}>
        <View style={{flex:1,minWidth:230,gap:8}}><Text style={styles.eyebrow}>L’arène est à vous</Text><Text style={[styles.title,{fontSize:width<500?28:46}]}>Une ville. Une fierté.{`\n`}Une place à défendre.</Text><Text style={styles.muted}>Des défis, des remontées et toute une bande derrière toi.</Text></View>
        <View style={styles.controls}>{Platform.OS==='web'?<Button subtle label={soundOn?"Couper le son":"Activer le son"} selected={soundOn} onPress={toggleSound}/>:null}<Button subtle label={paused?'Reprendre':'Pause'} onPress={()=>setPaused(v=>!v)} /><Button subtle label={speed===1?'Accélérer ×3':'Vitesse normale'} selected={speed===3} onPress={()=>setSpeed(v=>v===1?3:1)} /><Button subtle label="Réinitialiser" onPress={()=>{setState(createSimulation());setClockReset(n=>n+1);setDraft('');setHearts([]);setCombo(0);}} /></View>
      </View>
      {soundError?<Text accessibilityRole="alert" style={styles.muted}>{soundError}</Text>:null}
      <View style={styles.metrics}>
        {[['8','joueurs fictifs'],[String(state.crowd),'supporters simulés'],[String(state.cheers),width<600?'réactions':'encouragements'],[`${state.tick} s`,'temps simulé']].map(([n,l])=><View key={l} style={[styles.metric,width<600?{minWidth:68,padding:10}:null]}><Text style={styles.metricValue}>{n}</Text><Text style={styles.metricLabel}>{l}</Text></View>)}
      </View>
      {!wide?<View style={styles.filters}><Button subtle label="Le duel" selected={panel==='duel'} onPress={()=>setPanel('duel')}/><Button subtle label="Le fil" selected={panel==='fil'} onPress={()=>setPanel('fil')}/><Button subtle label="Classement" selected={panel==='classement'} onPress={()=>setPanel('classement')}/></View>:null}
      <View style={[styles.layout,wide?{flexDirection:'row'}:null]}>
        <View style={{flex:wide?1.7:undefined,gap:18,minWidth:0,display:!wide&&panel==='classement'?'none':'flex'}}>
          <View style={[styles.duel,!wide&&panel!=='duel'?{display:'none'}:null]}>
            <View pointerEvents="none" style={{...StyleSheet.absoluteFillObject,zIndex:10,overflow:'hidden',borderRadius:22}}>{hearts.map(h=><FlyingHeart key={h.id} id={h.id} color={h.color} onDone={removeHeart}/>)}</View>
            {combo>=5?<Text accessibilityLiveRegion="polite" style={{color:'#F8CF68',fontSize:16,fontWeight:'900',textAlign:'center'}}>COMBO ×{combo} · Fais du bruit !</Text>:null}
            <View style={styles.sectionHead}><View style={styles.liveBadge}><View style={[styles.dot,{backgroundColor:paused?'#B8B5C2':'#FF7E94'}]} /><Text style={styles.liveText}>{state.rematch&&state.rematch.phase!=='queued'?'Repos avant revanche · simulation':state.presence?.status==='waiting'?'Délai de présence · simulation':state.presence?.status==='forfeit'?'Forfait · simulation':state.duel.finished?'Duel terminé · simulation':paused?'Duel en pause · simulation':'Duel en cours · simulation'}</Text></View><Text style={styles.round}>Manche {state.duel.round}</Text></View>
            <Text style={styles.duelTitle}>Le duel des voisins</Text><Text style={styles.muted}>Pompes · 60 secondes · animation de scores, sans vidéo</Text>
            {state.presence ? <View style={{padding:12,gap:8,borderRadius:12,backgroundColor:state.presence.status==='waiting'?'#D4AF3718':'#EF444418',borderWidth:1,borderColor:state.presence.status==='waiting'?'#D4AF3750':'#EF444450'}}>
              <Text style={styles.messageName}>{state.presence.status==='waiting'?`${state.players.find(p=>p.id===state.presence!.playerId)?.name} manque à l’appel`:'Forfait pour absence'}</Text>
              <Text style={styles.muted}>{state.presence.status==='waiting'?'20 secondes pour rejoindre avant élimination. Délai raccourci pour cette démonstration.':'Éliminé de ce duel : −10 de fiabilité et 60 secondes de suspension simulée. Aucun record supprimé.'}</Text>
              {state.presence.status==='waiting'?<Button label="Rejoindre à temps" onPress={()=>{setState(arriveInTime);setClockReset(n=>n+1);}}/>:null}
            </View>:null}
            <View style={styles.fighters}>
              {[a,b].map((p,i)=><View key={p.id} style={[styles.fighter,{backgroundColor:p.color+'12',borderColor:p.color+'45'}]}><Pressable accessibilityRole="button" accessibilityLabel={`Taper pour encourager ${p.name}`} onPress={()=>tap(p)} style={({pressed})=>({opacity:pressed?0.8:1,padding:4})}><EnergyAvatar player={p} count={i===0?scoreA:scoreB} size={width<420?66:84}/></Pressable><Text style={styles.playerName}>{p.name}</Text><Text style={[styles.city,{color:p.color}]}>{p.city}</Text><Text style={styles.small}>{Math.round(state.crowd*(i===0?0.46:0.54))} soutiens simulés</Text><Text accessibilityLabel={`${p.name} : ${i===0?scoreA:scoreB} pompes simulées`} style={[styles.duelScore,{color:p.color}]}>{i===0?scoreA:scoreB}</Text><Text style={styles.metricLabel}>pompes</Text><Text accessibilityLabel={`${p.name} : ${state.taps[p.id]} taps de soutien simulés`} style={{color:p.color,fontWeight:'800',fontSize:12}}>♥ {state.taps[p.id]} taps</Text><Button subtle label={state.mySide===p.id?`Tu soutiens ${p.name}`:`Soutenir ${p.name}`} selected={state.mySide===p.id} disabled={state.duel.finished} onPress={()=>setState(s=>support(s,p.id))}/></View>)}
            </View>
            <View style={styles.timerRow}><PrecisionClock running={!paused&&focused&&active&&visible} speed={speed} remaining={state.rematch&&state.rematch.phase!=='queued'?state.rematch.remaining:state.presence?.remaining??state.duel.remaining} round={state.duel.round} resetKey={clockReset} onSeconds={onSeconds}/><Text style={styles.leadChange}>{state.presence||(state.rematch&&state.rematch.phase!=='queued')?leader:state.duel.finished?(scoreA===scoreB?'Égalité !':`${scoreA>scoreB?a.name:b.name} remporte la manche 🏆`):leader}</Text></View>
            <View style={{gap:8,padding:12,borderRadius:12,backgroundColor:'#A78BFA10'}}>
              <Text style={styles.muted}>{state.rematch?.phase==='queued'?'Revanche réservée : la manche continue, puis 30 secondes de repos.':state.rematch?.phase==='rest'?'Repos de démonstration : prends plus de temps si nécessaire. Aucune reprise forcée.':state.rematch?.phase==='ready'?'Le repos est terminé. Lance la revanche quand tu es prêt.':'Même adversaire, même format. La revanche prévoit 30 secondes de repos, prolongeables en attendant.'}</Text>
              {state.rematch?.phase==='ready'?<Button label="Lancer la revanche" onPress={()=>{setState(beginRematch);setClockReset(n=>n+1);}}/>:<Button subtle label={state.rematch?'Revanche réservée':'Revanche · repos 30 s'} disabled={!!state.rematch||!!state.presence} onPress={()=>{setState(requestRematch);if(state.duel.finished)setClockReset(n=>n+1);}}/>}
            </View>
            <Button subtle label="Simuler un retard" disabled={!!state.presence||!!state.rematch} onPress={()=>{setState(startPresenceCheck);setClockReset(n=>n+1);}}/>
            <View style={styles.track}><View style={[styles.progress,{width:`${(60-state.duel.remaining)/60*100}%`}]} /></View>
            <Button subtle label="♥ Tap tap · Encourager" onPress={()=>tap(state.players.find(p=>p.id===state.mySide)??a)}/>
            <Text style={styles.small}>Tape sur l’avatar pour envoyer des cœurs. Les taps soutiennent le joueur, sans modifier ses répétitions.</Text>
            <View style={styles.reactions}><Text style={[styles.muted,{flex:1,minWidth:130}]}>Fais du bruit pour eux</Text><Button subtle label="🔥 Allez !" onPress={()=>setState(cheer)} /><Button subtle label="😂 Énorme" onPress={()=>setState(s=>addMyComment(cheer(s),'Énorme 😂'))} /></View>
          </View>
          <View style={[styles.card,!wide&&panel!=='fil'?{display:'none'}:null]}>
            <View style={styles.sectionHead}><Text style={styles.sectionTitle}>Au bord du terrain</Text><Text style={styles.pill}>Fil simulé</Text></View>
            <Text style={styles.muted}>Les records et les commentaires arrivent au rythme du jeu.</Text>
            <View style={styles.compose}><Avatar player={YOU} size={38}/><TextInput accessibilityLabel="Ton commentaire dans la simulation" value={draft} onChangeText={setDraft} maxLength={240} placeholder="Encourage, chambre gentiment…" placeholderTextColor="#9895A5" style={styles.input} onSubmitEditing={send} returnKeyType="send" /><Button label="Envoyer" onPress={send} disabled={!draft.trim()} /></View>
            <View style={{gap:0}}>{state.messages.slice(0,12).map(m=>{const p=state.players.find(p=>p.id===m.playerId)??YOU;return <View key={m.id} style={styles.message}><Avatar player={p}/><View style={{flex:1,gap:5}}><View style={styles.messageHead}><Text style={[styles.messageName,{color:p.color}]}>{p.name}</Text><Text style={styles.small}>{p.city} · {m.tick===state.tick?'à l’instant':`il y a ${state.tick-m.tick} s`}</Text></View><Text style={[styles.messageText,m.kind==='record'?{color:'#F7DA87'}:null]}>{m.text}</Text>{m.kind==='record'?<Text style={styles.recordTag}>Record fictif · classement mis à jour</Text>:null}</View></View>;})}</View>
          </View>
        </View>
        <View style={{flex:wide?1:undefined,gap:18,minWidth:0,display:!wide&&panel!=='classement'?'none':'flex'}}>
          <View style={styles.card}>
            <View style={styles.sectionHead}><Text style={styles.sectionTitle}>La course au sommet</Text><Text style={styles.crown}>♛</Text></View>
            <View style={styles.filters}><Button subtle label="Pompes" selected={format==='pushups'} onPress={()=>setFormat('pushups')}/><Button subtle label="Tractions" selected={format==='pullups'} onPress={()=>setFormat('pullups')}/></View>
            <View style={styles.filters}><Button subtle label="Monde" selected={!country} onPress={()=>setCountry(false)}/><Button subtle label="France" selected={country} onPress={()=>setCountry(true)}/></View>
            <Text style={styles.small}>Records simulés · les places bougent à chaque dépassement.</Text>
            {board.map((p,i)=>{const old=state.previousRanks[`${country?'France:':''}${format}:${p.id}`];const delta=old-(i+1);return <View key={p.id} style={[styles.rankRow,i===0?styles.first:null]}><Text style={[styles.rank,i===0?{color:'#F4D477'}:null]}>{String(i+1).padStart(2,'0')}</Text><Avatar player={p} size={38}/><View style={{flex:1,gap:3}}><Text style={styles.messageName}>{p.name}{i===0?' 👑':''}</Text><Text style={styles.small}>{p.city} · fiabilité {state.reliability[p.id]} %</Text></View><Text accessibilityLabel={delta>0?`${p.name} monte de ${delta} place${delta>1?'s':''}`:delta<0?`${p.name} perd ${-delta} place${delta< -1?'s':''}`:'Place stable'} style={[styles.delta,{color:delta>0?'#49D6B0':delta<0?'#FF8FAD':'#898794'}]}>{delta>0?`↑${delta}`:delta<0?`↓${-delta}`:'—'}</Text><Text style={styles.rankScore}>{p.scores[format]}</Text></View>;})}
            <Button subtle label="Faire basculer le classement" onPress={()=>setState(s=>dethrone(s,format))}/>
          </View>
          <View style={[styles.card,{borderColor:'#A78BFA50',backgroundColor:'#191525'}]}><Text style={styles.sectionTitle}>Ici, on joue ensemble.</Text><Text style={styles.muted}>Les supporters font l’ambiance. Les performances font le classement.</Text><Text style={styles.small}>Pause pour observer un état. Accélère pour voir les remontées. Tes messages restent dans cette simulation et disparaissent à la remise à zéro.</Text></View>
        </View>
      </View>
    </ScrollView>
  </ScreenContainer>;
}

const styles=StyleSheet.create({
  page:{gap:22,paddingBottom:44},demoBar:{padding:14,borderRadius:14,backgroundColor:'#D4AF3712',borderWidth:1,borderColor:'#D4AF3745',flexDirection:'row',alignItems:'center',flexWrap:'wrap',gap:12},demoTitle:{color:'#F0CE68',fontWeight:'800',fontSize:13},demoText:{color:'#BEB6A1',fontSize:12,lineHeight:18},intro:{flexDirection:'row',flexWrap:'wrap',gap:20,alignItems:'center'},eyebrow:{color:'#A78BFA',fontWeight:'700',fontSize:13},title:{color:'#FFF8EC',fontWeight:'900',lineHeight:undefined,letterSpacing:-1},muted:{color:'#B5B1C1',fontSize:13,lineHeight:20},controls:{flexDirection:'row',flexWrap:'wrap',gap:8,maxWidth:'100%',flexShrink:1},button:{minHeight:44,paddingHorizontal:14,paddingVertical:12,borderRadius:12,backgroundColor:'#D4AF37',alignItems:'center',justifyContent:'center'},subtle:{backgroundColor:'#FFFFFF08',borderWidth:1,borderColor:'#FFFFFF1C'},selected:{borderColor:'#D4AF37',backgroundColor:'#D4AF3720'},buttonText:{color:'#15110A',fontWeight:'800',fontSize:12},metrics:{flexDirection:'row',flexWrap:'wrap',gap:8},metric:{flex:1,minWidth:120,padding:14,borderLeftWidth:2,borderLeftColor:'#A78BFA50',backgroundColor:'#17151E'},metricValue:{color:'#F7F5F2',fontWeight:'900',fontSize:24},metricLabel:{color:'#A6A1B4',fontSize:11,lineHeight:17},layout:{gap:18},duel:{backgroundColor:'#14131D',borderRadius:22,borderWidth:1,borderColor:'#A78BFA40',padding:18,gap:14},sectionHead:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10},liveBadge:{flexDirection:'row',alignItems:'center',gap:6},dot:{width:6,height:6,borderRadius:3},liveText:{color:'#FFAFBE',fontSize:11,fontWeight:'800'},round:{color:'#A8A1B8',fontSize:11},duelTitle:{color:'#FFF8EC',fontWeight:'900',fontSize:25},fighters:{flexDirection:'row',gap:10},fighter:{flex:1,padding:12,borderRadius:18,borderWidth:1,alignItems:'center',gap:8,minWidth:0},playerName:{color:'#FFF7EC',fontSize:21,fontWeight:'900'},city:{fontSize:12,fontWeight:'700'},duelScore:{fontSize:54,fontWeight:'900',lineHeight:60},timerRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},timer:{color:'#FFF7EC',fontSize:27,fontWeight:'900'},leadChange:{color:'#F6D580',fontSize:12,fontWeight:'700',flexShrink:1,textAlign:'right'},track:{height:5,backgroundColor:'#FFFFFF12',borderRadius:4,overflow:'hidden'},progress:{height:5,backgroundColor:'#D4AF37'},reactions:{flexDirection:'row',alignItems:'center',gap:8,flexWrap:'wrap'},card:{backgroundColor:'#14131B',borderRadius:20,borderWidth:1,borderColor:'#FFFFFF14',padding:18,gap:14},sectionTitle:{fontWeight:'900',fontSize:18,color:'#F7F2E9'},pill:{fontSize:10,fontWeight:'700',color:'#B4A5D7',backgroundColor:'#A78BFA14',paddingHorizontal:8,paddingVertical:5,borderRadius:10},compose:{flexDirection:'row',alignItems:'center',gap:8,flexWrap:'wrap'},input:{flex:1,minWidth:130,borderRadius:12,borderWidth:1,borderColor:'#FFFFFF20',backgroundColor:'#0C0B11',color:'#F7F5F2',paddingHorizontal:12,paddingVertical:12,minHeight:46,fontSize:13},message:{flexDirection:'row',gap:10,paddingVertical:15,borderBottomWidth:1,borderBottomColor:'#FFFFFF0A'},messageHead:{flexDirection:'row',alignItems:'center',flexWrap:'wrap',gap:7},messageName:{fontWeight:'800',fontSize:13,color:'#F7F5F2'},small:{fontSize:11,color:'#9D97AD',lineHeight:17},messageText:{fontSize:14,lineHeight:21,color:'#E7E0EE'},recordTag:{fontSize:10,color:'#D8BE72'},crown:{color:'#D4AF37',fontSize:25},filters:{flexDirection:'row',gap:8,flexWrap:'wrap'},rankRow:{flexDirection:'row',gap:9,alignItems:'center',paddingVertical:10,paddingHorizontal:8,borderRadius:12},first:{backgroundColor:'#D4AF3710',borderWidth:1,borderColor:'#D4AF3740'},rank:{color:'#8D879B',fontWeight:'800',fontSize:12,width:21},rankScore:{color:'#F8F0E4',fontWeight:'900',fontSize:24,minWidth:32,textAlign:'right'},delta:{fontWeight:'800',fontSize:11,minWidth:24,textAlign:'right'},
});

export type SimFormat = 'pushups' | 'pullups';
export type SimPlayer = { id: string; name: string; city: string; country: string; color: string; skin: string; hair: string; scores: Record<SimFormat, number> };
export type SimMessage = { id: number; playerId: string; text: string; kind: 'comment' | 'record' | 'duel' | 'support'; tick: number };
export type SimPresence = {playerId:string;remaining:number;status:'waiting'|'forfeit';resolvedAt:number|null};
export type SimState = { rematch:{phase:'queued'|'rest'|'ready';remaining:number}|null; finishedAt:number|null; taps:Record<string,number>; presence:SimPresence|null; reliability:Record<string,number>; suspendedUntil:Record<string,number>; tick: number; players: SimPlayer[]; messages: SimMessage[]; previousRanks: Record<string, number>; duel: { round: number; a: number; b: number; scoreA: number; scoreB: number; remaining: number; finished: boolean }; crowd: number; cheers: number; mySide: string | null; nextId: number };
const ROSTER = [
  ['lea', 'Léa', 'Toulouse', 'France', '#A78BFA', '#E9B490', '#442D42', 48, 12],
  ['moussa', 'Moussa', 'Toulouse', 'France', '#49D6B0', '#89553D', '#201B27', 55, 15],
  ['yanis', 'Yanis', 'Montpellier', 'France', '#6AB4FF', '#C28A62', '#252232', 46, 11],
  ['sarah', 'Sarah', 'Lyon', 'France', '#FF8FAD', '#B47955', '#352437', 52, 14],
  ['tom', 'Tom', 'Paris', 'France', '#F4BE55', '#E9BB99', '#73472D', 62, 18],
  ['ines', 'Inès', 'Bordeaux', 'France', '#F58B64', '#C9906C', '#2C2536', 50, 13],
  ['diego', 'Diego', 'Madrid', 'Espagne', '#63CAD7', '#C0845D', '#292333', 57, 16],
  ['noa', 'Noa', 'Lausanne', 'Suisse', '#B7CF6B', '#E8B792', '#987348', 54, 17],
] as const;
export function ranks(players: SimPlayer[], format: SimFormat = 'pushups') {
  return [...players].sort((a,b) => b.scores[format] - a.scores[format] || a.id.localeCompare(b.id));
}
function rankMap(players:SimPlayer[]) {return Object.fromEntries((['pushups','pullups'] as const).flatMap(f=>[...ranks(players,f).map((p,i)=>[`${f}:${p.id}`,i+1]),...ranks(players.filter(p=>p.country==='France'),f).map((p,i)=>[`France:${f}:${p.id}`,i+1])]));}
export function createSimulation(): SimState {
  const players = ROSTER.map(([id,name,city,country,color,skin,hair,pushups,pullups])=>({id,name,city,country,color,skin,hair,scores:{pushups,pullups}}));
  return { rematch:null,finishedAt:null,taps:Object.fromEntries(players.map(p=>[p.id,0])),presence:null,reliability:Object.fromEntries(players.map(p=>[p.id,100])),suspendedUntil:{},tick: 0, players, previousRanks: rankMap(players),
    messages: [
      {id:3,playerId:'moussa',text:'Toulouse, vous êtes là ? On compte sur vous 🔥',kind:'comment',tick:0},
      {id:2,playerId:'lea',text:'Demain c’est toi contre moi, prépare tes bras 😂',kind:'comment',tick:0},
      {id:1,playerId:'tom',text:'62 pompes. Le record est posé. Qui vient le chercher ?',kind:'record',tick:0},
    ], duel:{round:1,a:1,b:2,scoreA:0,scoreB:0,remaining:60,finished:false}, crowd:38,cheers:126,mySide:null,nextId:4 };
}
function message(state: SimState, playerId: string, text: string, kind: SimMessage['kind']): SimState {
  return {...state,nextId:state.nextId+1,messages:[{id:state.nextId,playerId,text,kind,tick:state.tick},...state.messages].slice(0,40)};
}
const CHAT = ['Allez, encore une ! 🔥','J’ai mal aux bras juste en regardant 😂','Le classement vient de bouger 👀','Propre ! L’amplitude est là 💪','On veut la revanche !','Toute la ville est derrière toi 🙌','Ça se joue à une répétition…','Cette remontée 😮‍💨','Les tractions après ça ? Vous êtes fous 😂','Le boss peut trembler 👑'];
export function advanceSimulation(previous: SimState): SimState {
  const tick=previous.tick+1;
  let state: SimState={...previous,tick,crowd:Math.min(999,previous.crowd+(tick%4===0?-2:3)),cheers:previous.cheers+3+tick%7,
    previousRanks:rankMap(previous.players)};
  const d=previous.duel;
  if(previous.rematch?.phase==='rest'){
    const remaining=Math.max(0,previous.rematch.remaining-1);
    return {...state,rematch:{phase:remaining?'rest':'ready',remaining}};
  }
  if(previous.rematch?.phase==='ready')return state;
  if(previous.rematch?.phase==='queued'&&d.finished)return {...state,rematch:{phase:'rest',remaining:30}};
  if(!d.finished&&!previous.presence)state={...state,taps:{...state.taps,
    [state.players[d.a].id]:state.taps[state.players[d.a].id]+1+tick%5,
    [state.players[d.b].id]:state.taps[state.players[d.b].id]+2+(tick*3)%7}};
  if (previous.presence?.status==='waiting') {
    const presence={...previous.presence,remaining:Math.max(0,previous.presence.remaining-1)};
    state={...state,presence};
    if(!presence.remaining){
      state={...state,presence:{...presence,status:'forfeit',resolvedAt:tick},duel:{...d,finished:true},finishedAt:tick,
        reliability:{...state.reliability,[presence.playerId]:Math.max(0,state.reliability[presence.playerId]-10)},
        suspendedUntil:{...state.suspendedUntil,[presence.playerId]:tick+60}};
      const player=state.players.find(p=>p.id===presence.playerId)!;
      state=message(state,player.id,`${player.name} est forfait pour absence : −10 de fiabilité et 60 s de suspension simulée. Les records restent intacts.`,'duel');
    }
    return state;
  }
  if(previous.presence?.status==='forfeit' && tick-(previous.presence.resolvedAt??tick)<8)return state;
  if(d.finished&&tick-(previous.finishedAt??tick)<8)return state;
  if (d.finished) {
    const eligible=state.players.map((p,i)=>i).filter(i=>(state.suspendedUntil[state.players[i].id]??0)<=tick);
    const a=eligible.find(i=>i> d.a)??eligible[0];
    const b=eligible.find(i=>i!==a&&i>d.b)??eligible.find(i=>i!==a)!;
    state={...state,presence:null,finishedAt:null,mySide:null,duel:{round:d.round+1,a,b,scoreA:0,scoreB:0,remaining:60,finished:false}};
    state=message(state,state.players[a].id,'Nouveau duel ! Venez soutenir votre champion.','duel');
  } else {
    const phase=(60-d.remaining)%10;
    const gainsA=[1,0,0,1,1,0,1,1,0,1],gainsB=[0,1,1,0,0,1,0,1,1,0];
    const scoreA=d.scoreA+((d.round%2?gainsA:gainsB)[phase]??0);
    const scoreB=d.scoreB+((d.round%2?gainsB:gainsA)[phase]??0);
    const remaining=Math.max(0,d.remaining-1);
    state={...state,duel:{...d,scoreA,scoreB,remaining,finished:remaining===0},finishedAt:remaining===0?tick:null};
    if (!remaining) state=message(state,state.players[scoreA>=scoreB?d.a:d.b].id,scoreA===scoreB?'Égalité ! On remet ça ? 🤝':`Duel gagné ${Math.max(scoreA,scoreB)}–${Math.min(scoreA,scoreB)}. La revanche est ouverte ! 🏆`,'duel');
  }
  if (tick%3===0) {
    const index=(Math.floor(tick/3)*3)%state.players.length;
    const format:SimFormat=tick%2===0?'pullups':'pushups';
    const player=state.players[index];
    const score=Math.min(format==='pushups'?200:100,player.scores[format]+(format==='pushups'?4+tick%5:1+tick%3));
    state={...state,players:state.players.map((p,i)=>i===index?{...p,scores:{...p.scores,[format]:score}}:p)};
    state=score>player.scores[format]
      ?message(state,player.id,`${score} ${format==='pushups'?'pompes en 60 s':'tractions strictes'} ! Nouveau record personnel. Qui me défie ?`,'record')
      :message(state,player.id,'On prépare la prochaine tentative 💪','comment');
  } else state=message(state,state.players[(tick*5)%8].id,CHAT[(tick-1)%CHAT.length],'comment');
  return state;
}
export function addMyComment(state: SimState, text: string): SimState {
  const clean=text.trim().slice(0,240);
  return clean?message(state,'you',clean,'comment'):state;
}
export function cheer(state:SimState,playerId?:string):SimState {
  const id=playerId??state.mySide??state.players[state.duel.a].id;
  if(!state.players.some(p=>p.id===id))return state;
  return {...state,cheers:state.cheers+1,taps:{...state.taps,[id]:(state.taps[id]??0)+1}};
}
export function dethrone(state:SimState,format:SimFormat):SimState {
  const board=ranks(state.players,format), challenger=board[1];
  const score=Math.min(format==='pushups'?200:100,board[0].scores[format]+1);
  if(score<=challenger.scores[format]) return state;
  const next={...state,previousRanks:rankMap(state.players),players:state.players.map(p=>p.id===challenger.id?{...p,scores:{...p.scores,[format]:score}}:p)};
  return message(next,challenger.id,`${score} ${format==='pushups'?'pompes':'tractions'} ! Je prends la première place. La couronne change de tête 👑`,'record');
}
export function support(state:SimState,playerId:string):SimState {
  if (![state.players[state.duel.a].id,state.players[state.duel.b].id].includes(playerId)||state.duel.finished) return state;
  if (state.mySide===playerId) return state;
  return message({...state,mySide:playerId,cheers:state.cheers+1},'you',`Je soutiens ${state.players.find(p=>p.id===playerId)?.name} ! Allez 💪`,'support');
}


/** Avance d'après l'horloge monotone : les retards de rendu ne font pas perdre des secondes. */
export function advanceClock(last:number,remainderMs:number,now:number,speed:number=1) {
  const elapsed=remainderMs+Math.max(0,now-last)*speed;
  const seconds=Math.floor(elapsed/1000);
  return {last:now,remainderMs:elapsed-seconds*1000,seconds};
}
export function formatCountdown(ms:number):string {
  const hundredths=Math.max(0,Math.ceil(ms/10));
  const minutes=Math.floor(hundredths/6000);
  const seconds=Math.floor(hundredths/100)%60;
  return `${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}.${String(hundredths%100).padStart(2,'0')}`;
}


/** Scénario de présence, sans sanctionner de compte réel. */
export function startPresenceCheck(state:SimState):SimState {
  if(state.presence)return state;
  const player=state.players[state.duel.b];
  return message({...state,presence:{playerId:player.id,remaining:20,status:'waiting',resolvedAt:null},duel:{...state.duel,remaining:60,scoreA:0,scoreB:0,finished:false}},player.id,`${player.name} est attendu. Le délai de présence commence.`,'duel');
}
export function arriveInTime(state:SimState):SimState {
  if(state.presence?.status!=='waiting')return state;
  return message({...state,presence:null},state.presence.playerId,'Présent ! Le duel peut commencer. 💪','duel');
}


export function requestRematch(state:SimState):SimState {
  if(state.rematch||state.presence)return state;
  return message({...state,rematch:{phase:state.duel.finished?'rest':'queued',remaining:30}},'you','Revanche demandée ! 30 secondes de repos après cette manche.','duel');
}
export function beginRematch(state:SimState):SimState {
  if(state.rematch?.phase!=='ready')return state;
  return message({...state,rematch:null,finishedAt:null,mySide:null,duel:{...state.duel,round:state.duel.round+1,scoreA:0,scoreB:0,remaining:60,finished:false}},'you','Les deux adversaires repartent pour la revanche !','duel');
}

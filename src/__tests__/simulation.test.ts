import { addMyComment, startPresenceCheck, arriveInTime, advanceClock, formatCountdown, advanceSimulation, cheer, createSimulation, dethrone, ranks, support } from '../simulation/arena';

describe('simulation locale IMMORTAL',()=>{
  it('change réellement le champion et les positions lors d’un dépassement',()=>{
    const before=createSimulation();
    const after=dethrone(before,'pushups');
    expect(ranks(before.players)[0].name).toBe('Tom');
    expect(ranks(after.players)[0].name).toBe('Diego');
    expect(after.previousRanks['pushups:diego']).toBe(2);
    expect(after.messages[0].kind).toBe('record');
    expect(before.players.find(p=>p.id==='diego')?.scores.pushups).toBe(57);
  });
  it('fait basculer la tête du duel puis termine une manche et lance la suivante',()=>{
    const start=createSimulation(),first=advanceSimulation(start),second=advanceSimulation(advanceSimulation(first));
    expect(first.duel.scoreA).toBeGreaterThan(first.duel.scoreB);
    expect(second.duel.scoreB).toBeGreaterThan(second.duel.scoreA);
    let state=start;
    for(let i=0;i<60;i++)state=advanceSimulation(state);
    expect(state.duel.finished).toBe(true);
    expect(state.duel.remaining).toBe(0);
    const next=advanceSimulation(state);
    expect(next.duel.round).toBe(2);
    expect(next.duel.finished).toBe(false);
    expect(next.duel.remaining).toBe(60);
    expect(next.duel.a).not.toBe(next.duel.b);
  });
  it('fait évoluer les records des deux disciplines',()=>{
    let state=createSimulation();
    const before=JSON.stringify(state.players.map(p=>p.scores));
    for(let i=0;i<12;i++)state=advanceSimulation(state);
    expect(JSON.stringify(state.players.map(p=>p.scores))).not.toBe(before);
    expect(state.players.some(p=>p.scores.pullups>18)).toBe(true);
    expect(state.messages.some(m=>m.kind==='record')).toBe(true);
  });
  it('borne le fil et les scores pendant une longue session',()=>{
    let state=createSimulation();
    for(let i=0;i<1200;i++)state=advanceSimulation(state);
    expect(state.messages).toHaveLength(40);
    expect(new Set(state.messages.map(m=>m.id)).size).toBe(40);
    expect(state.players.every(p=>p.scores.pushups<=200&&p.scores.pullups<=100)).toBe(true);
    expect(state.duel.a).not.toBe(state.duel.b);
    expect(state.duel.remaining).toBeGreaterThanOrEqual(0);
  });
  it('enregistre un commentaire utilisateur et refuse le vide',()=>{
    const before=createSimulation();
    expect(addMyComment(before,'   ')).toBe(before);
    const after=addMyComment(before,'  Allez Toulouse !  ');
    expect(after.messages[0]).toMatchObject({playerId:'you',text:'Allez Toulouse !'});
    expect(addMyComment(after,'a'.repeat(300)).messages[0].text).toHaveLength(240);
  });
  it('ne compte pas plusieurs fois un même soutien',()=>{
    const before=createSimulation(),after=support(before,'moussa');
    expect(after.mySide).toBe('moussa');
    expect(support(after,'moussa')).toBe(after);
    expect(support(after,'tom')).toBe(after);
    expect(support({...after,duel:{...after.duel,finished:true}},'yanis').mySide).toBe('moussa');
  });
  it('réinitialise intégralement les interactions et compte les encouragements',()=>{
    const after=cheer(addMyComment(createSimulation(),'test'));
    expect(after.cheers).toBe(127);
    const reset=createSimulation();
    expect(reset.messages.some(m=>m.text==='test')).toBe(false);
    expect(reset.tick).toBe(0);
    expect(reset.mySide).toBeNull();
  });
});


it('ne fait jamais baisser un record après un dépassement manuel au plafond',()=>{
  let state=createSimulation();
  for(let i=0;i<400;i++)state=dethrone(state,'pushups');
  const scores=Object.fromEntries(state.players.map(p=>[p.id,p.scores.pushups]));
  for(let i=0;i<100;i++)state=advanceSimulation(state);
  for(const p of state.players)expect(p.scores.pushups).toBeGreaterThanOrEqual(scores[p.id]);
});

it('compare les places de France aux places de France',()=>{
  const state=dethrone(createSimulation(),'pullups');
  expect(state.previousRanks['France:pullups:moussa']).toBe(2);
  expect(state.previousRanks['pullups:moussa']).toBe(4);
});


describe('précision du chrono et des répétitions',()=>{
  it('conserve les fractions entre des images irrégulières',()=>{
    let clock={last:0,remainderMs:0,seconds:0},total=0;
    for(const now of [16,34,51,250,499,998,1007,1345,1989,2003]){
      clock=advanceClock(clock.last,clock.remainderMs,now);total+=clock.seconds;
    }
    expect(total).toBe(2);
    expect(clock.remainderMs).toBe(3);
  });
  it('rattrape un retard sans dérive et accélère exactement par trois',()=>{
    expect(advanceClock(0,0,2750)).toMatchObject({seconds:2,remainderMs:750});
    expect(advanceClock(1000,250,1500,3)).toMatchObject({seconds:1,remainderMs:750});
  });
  it('affiche les centièmes sans valeur négative',()=>{
    expect(formatCountdown(60000)).toBe('01:00.00');
    expect(formatCountdown(59984)).toBe('00:59.99');
    expect(formatCountdown(0)).toBe('00:00.00');
    expect(formatCountdown(-2)).toBe('00:00.00');
  });
  it('ajoute au maximum une répétition par joueur et par seconde',()=>{
    let state=createSimulation();
    for(let i=0;i<60;i++){
      const next=advanceSimulation(state);
      expect(next.duel.scoreA-state.duel.scoreA).toBeGreaterThanOrEqual(0);
      expect(next.duel.scoreA-state.duel.scoreA).toBeLessThanOrEqual(1);
      expect(next.duel.scoreB-state.duel.scoreB).toBeGreaterThanOrEqual(0);
      expect(next.duel.scoreB-state.duel.scoreB).toBeLessThanOrEqual(1);
      expect(next.duel.remaining).toBe(59-i);
      state=next;
    }
  });
});


describe('présence et forfait',()=>{
  it('applique une seule pénalité à l’expiration du délai',()=>{
    const before=createSimulation();
    let state=startPresenceCheck(before);
    const missing=state.presence!.playerId;
    for(let i=0;i<19;i++)state=advanceSimulation(state);
    expect(state.reliability[missing]).toBe(100);
    expect(state.presence?.remaining).toBe(1);
    state=advanceSimulation(state);
    expect(state.presence?.status).toBe('forfeit');
    expect(state.reliability[missing]).toBe(90);
    expect(state.duel.finished).toBe(true);
    expect(state.players).toEqual(before.players);
    expect(arriveInTime(state)).toBe(state);
    for(let i=0;i<9;i++)state=advanceSimulation(state);
    expect(state.reliability[missing]).toBe(90);
    expect(state.players[state.duel.a].id).not.toBe(missing);
    expect(state.players[state.duel.b].id).not.toBe(missing);
  });
  it('annule le forfait si le joueur rejoint à temps',()=>{
    let state=startPresenceCheck(createSimulation());
    for(let i=0;i<12;i++)state=advanceSimulation(state);
    state=arriveInTime(state);
    expect(state.presence).toBeNull();
    expect(Object.values(state.reliability).every(n=>n===100)).toBe(true);
    expect(state.duel.remaining).toBe(60);
    expect(advanceSimulation(state).duel.remaining).toBe(59);
  });
});


it('compte chaque tap sans modifier les répétitions ni les records',()=>{
  const before=createSimulation();let state=before;
  for(let i=0;i<50;i++)state=cheer(state,'moussa');
  expect(state.taps.moussa).toBe(50);
  expect(state.cheers).toBe(before.cheers+50);
  expect(state.duel).toEqual(before.duel);
  expect(state.players).toEqual(before.players);
  expect(state.taps.yanis).toBe(0);
});

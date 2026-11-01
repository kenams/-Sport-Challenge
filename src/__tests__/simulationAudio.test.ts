import { ArenaAudio, soundCues } from '../simulation/audio';
import {advanceSimulation,createSimulation} from '../simulation/arena';

describe('sons de l’arène',()=>{
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'window');
  let context:any;
  let Constructor:jest.Mock;
  beforeEach(()=>{
    context={state:'suspended',currentTime:0,destination:{},resume:jest.fn(async()=>{context.state='running';}),suspend:jest.fn(async()=>{context.state='suspended';}),close:jest.fn(async()=>{context.state='closed';}),
      createOscillator:jest.fn(()=>({frequency:{value:0,setValueAtTime:jest.fn(),exponentialRampToValueAtTime:jest.fn()},connect:jest.fn(),disconnect:jest.fn(),start:jest.fn(),stop:jest.fn()})),
      createGain:jest.fn(()=>({gain:{setValueAtTime:jest.fn(),linearRampToValueAtTime:jest.fn(),exponentialRampToValueAtTime:jest.fn()},connect:jest.fn(),disconnect:jest.fn()}))};
    Constructor=jest.fn(()=>context);
    Object.defineProperty(globalThis,'window',{configurable:true,value:{AudioContext:Constructor}});
  });
  afterEach(()=>{if(descriptor)Object.defineProperty(globalThis,'window',descriptor);else delete (globalThis as any).window;});
  it('ne crée et ne joue rien avant activation',()=>{
    const audio=new ArenaAudio();audio.play('full');expect(Constructor).not.toHaveBeenCalled();
  });
  it('joue trois notes à jauge pleine avec un volume limité',async()=>{
    const audio=new ArenaAudio();expect(await audio.enable()).toBe(true);audio.play('full');
    expect(context.createOscillator).toHaveBeenCalledTimes(3);
    for(const result of context.createGain.mock.results)expect(result.value.gain.linearRampToValueAtTime.mock.calls[0][0]).toBeLessThanOrEqual(0.045);
  });
  it('coupe le son et libère le contexte à la fermeture',async()=>{
    const audio=new ArenaAudio();await audio.enable();await audio.suspend();audio.play('rep');
    expect(context.createOscillator).not.toHaveBeenCalled();
    await audio.dispose();expect(context.close).toHaveBeenCalledTimes(1);
  });
  it('gère un navigateur sans son',async()=>{
    Object.defineProperty(globalThis,'window',{configurable:true,value:{}});
    expect(await new ArenaAudio().enable()).toBe(false);
  });
});


describe('rythme sonore de fin de duel',()=>{
  it('joue chacun des dix coups et un impact final',()=>{
    let state=createSimulation();
    const seconds:number[]=[];let impacts=0;
    for(let i=0;i<60;i++){
      const next=advanceSimulation(state),cues=soundCues(state,next);
      if(cues.includes('countdown'))seconds.push(next.duel.remaining);
      if(cues.includes('finish'))impacts++;
      state=next;
    }
    expect(seconds).toEqual([10,9,8,7,6,5,4,3,2,1]);
    expect(impacts).toBe(1);
  });
  it('ne masque pas la dixième seconde lorsqu’une jauge est pleine',()=>{
    const state=createSimulation();
    const previous={...state,duel:{...state.duel,remaining:11,scoreA:29}};
    const next={...state,duel:{...state.duel,remaining:10,scoreA:30}};
    expect(soundCues(previous,next)).toEqual(['countdown','full']);
  });
});

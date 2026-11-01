/** Sons synthétisés originaux. Aucun téléchargement, aucune lecture avant activation volontaire. */
import type { SimState } from './arena';
export type ArenaSound = 'rep' | 'full' | 'countdown' | 'start' | 'forfeit' | 'finish';
export class ArenaAudio {
  private context: AudioContext | null = null;
  async enable(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    const Constructor = window.AudioContext ?? (window as unknown as {webkitAudioContext?: typeof AudioContext}).webkitAudioContext;
    if (!Constructor) return false;
    this.context ??= new Constructor();
    await this.context.resume();
    return this.context.state === 'running';
  }
  play(sound: ArenaSound): void {
    const ctx=this.context;
    if (!ctx || ctx.state !== 'running') return;
    if(sound==='countdown'||sound==='finish') {
      const start=ctx.currentTime;
      const oscillator=ctx.createOscillator(),gain=ctx.createGain();
      const duration=sound==='finish'?0.48:0.23;
      oscillator.type='sine';
      oscillator.frequency.setValueAtTime(sound==='finish'?180:135,start);
      oscillator.frequency.exponentialRampToValueAtTime(sound==='finish'?38:48,start+duration*0.75);
      gain.gain.setValueAtTime(0,start);
      gain.gain.linearRampToValueAtTime(sound==='finish'?0.08:0.065,start+0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001,start+duration);
      oscillator.connect(gain);gain.connect(ctx.destination);
      oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
      oscillator.start(start);oscillator.stop(start+duration+0.01);
      return;
    }
    const tones = sound==='full'  ? [660,880,1100] : sound==='start' ? [440,660] : sound==='forfeit' ? [330,220] : [220];
    tones.forEach((frequency,index)=>{
      const oscillator=ctx.createOscillator(),gain=ctx.createGain();
      const start=ctx.currentTime+index*0.105,duration=sound==='rep'?0.035:0.13;
      oscillator.type=sound==='rep'?'sine':'triangle';oscillator.frequency.value=frequency;
      gain.gain.setValueAtTime(0,start);
      gain.gain.linearRampToValueAtTime(sound==='rep'?0.018:0.045,start+0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001,start+duration);
      oscillator.connect(gain);gain.connect(ctx.destination);
      oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
      oscillator.start(start);oscillator.stop(start+duration+0.01);
    });
  }
  async suspend():Promise<void> {await this.context?.suspend();}
  async dispose():Promise<void> {const ctx=this.context;this.context=null;if(ctx&&ctx.state!=='closed')await ctx.close();}
}


/** Les dix dernières secondes ont priorité : aucun signal de jauge ne masque le compte à rebours. */
export function soundCues(previous:SimState,state:SimState):ArenaSound[] {
  if(state.presence?.status==='forfeit'&&previous.presence?.status!=='forfeit')return ['forfeit'];
  if(state.duel.round!==previous.duel.round)return ['start'];
  if(state.duel.finished&&!previous.duel.finished)return ['finish'];
  const remaining=state.presence?.remaining??state.duel.remaining;
  const before=previous.presence?.remaining??previous.duel.remaining;
  const cues:ArenaSound[]=[];
  if(remaining>0&&remaining<=10&&remaining<before)cues.push('countdown');
  const full=(state.duel.scoreA>=30&&previous.duel.scoreA<30)||(state.duel.scoreB>=30&&previous.duel.scoreB<30);
  if(full)cues.push('full');
  if(!cues.length&&(state.duel.scoreA>previous.duel.scoreA||state.duel.scoreB>previous.duel.scoreB))cues.push('rep');
  return cues;
}

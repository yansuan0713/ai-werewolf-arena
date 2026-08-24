export const ROLES = ['wolf', 'seer', 'witch', 'hunter', 'villager'] as const;
export type Role = (typeof ROLES)[number];
export const ROLE_NAMES: Record<Role, string> = { wolf: '狼人', seer: '预言家', witch: '女巫', hunter: '猎人', villager: '村民' };

export const PHASES = ['setup','night_wolf','night_seer','night_witch','dawn','last_words','day_speech','day_vote','runoff_speech','runoff_vote','hunter_action','ended'] as const;
export type Phase = (typeof PHASES)[number];
export const PHASE_NAMES: Record<Phase, string> = { setup:'设置',night_wolf:'狼人行动',night_seer:'预言家行动',night_witch:'女巫行动',dawn:'天亮',last_words:'遗言',day_speech:'白天发言',day_vote:'投票',runoff_speech:'PK 发言',runoff_vote:'PK 投票',hunter_action:'猎人行动',ended:'游戏结束' };

export type DeathCause = 'wolf' | 'poison' | 'vote' | 'shot';
export interface Player { id:string; seat:number; name:string; modelLabel:string; role:Role; alive:boolean; deathCause?:DeathCause; }
export interface GameConfig { nightDeathLastWords:boolean; firstNightSelfSave:boolean; revealOnDeath:boolean; }
export type ActionKind = 'kill'|'inspect'|'antidote'|'poison'|'no_medicine'|'none'|'vote'|'speech'|'last_words'|'shoot'|'no_shoot';
export interface ParsedAction { kind:ActionKind; targetSeat?:number; text?:string; abstain?:boolean; matched:string; }
export interface ActionRecord { id:string; day:number; phase:Phase; playerId:string; action:ParsedAction; raw:string; timestamp:string; result?:string; }
export interface LogEntry { id:string; timestamp:string; day:number; phase:Phase; message:string; }
export interface WitchState { antidoteAvailable:boolean; poisonAvailable:boolean; }
export interface NightState { wolfTarget?:number|null; poisonedSeat?:number; savedSeat?:number; deaths:number[]; }
export interface GameState { id:string; title:string; createdAt:string; updatedAt:string; phase:Phase; day:number; started:boolean; players:Player[]; config:GameConfig; witch:WitchState; currentNight:NightState; actions:ActionRecord[]; publicLog:LogEntry[]; privateLogs:Record<string,LogEntry[]>; godLog:LogEntry[]; runoffSeats:number[]; pendingHunterId?:string; winner?:'good'|'wolves'; winReason?:string; }
export interface PlayerDraft { name:string; modelLabel:string; role?:Role; }
export interface CreateGameInput { title?:string; players:PlayerDraft[]; assignment:'random'|'manual'; config?:Partial<GameConfig>; }

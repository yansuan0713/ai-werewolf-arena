import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type { GameState } from '../src/shared/types.js';

interface SaveOptions { undo?: GameState; }

function parseGame(raw:string,expectedId:string):GameState {
  const value=JSON.parse(raw) as Partial<GameState>;
  if(!value||value.id!==expectedId||!Array.isArray(value.players)||typeof value.phase!=='string') throw new Error('存档结构无效');
  return value as GameState;
}

export class GameStore {
  constructor(private readonly dir=path.resolve(process.env.DATA_DIR||path.join(process.cwd(),'data','games'))){}
  private assertId(id:string){if(!/^[a-zA-Z0-9-]+$/.test(id))throw new Error('非法对局 ID');}
  private file(id:string){this.assertId(id);return path.join(this.dir,`${id}.json`);}
  private backupFile(id:string){this.assertId(id);return path.join(this.dir,`${id}.backup.json`);}
  private undoFile(id:string){this.assertId(id);return path.join(this.dir,`${id}.undo.json`);}

  private async atomicWrite(file:string,contents:string){
    await mkdir(this.dir,{recursive:true});
    const temporary=path.join(this.dir,`.${path.basename(file)}.${randomUUID()}.tmp`);
    try{await writeFile(temporary,contents,'utf8');await rename(temporary,file);}
    catch(error){await rm(temporary,{force:true});throw error;}
  }

  async save(game:GameState,options:SaveOptions={}){
    await mkdir(this.dir,{recursive:true});
    game.updatedAt=new Date().toISOString();
    let previous:string|undefined;
    try{const raw=await readFile(this.file(game.id),'utf8');parseGame(raw,game.id);previous=raw;}catch{/* 新对局或损坏主文件不覆盖已有备份。 */}
    if(previous)await this.atomicWrite(this.backupFile(game.id),previous);
    if(options.undo)await this.atomicWrite(this.undoFile(game.id),JSON.stringify(options.undo,null,2));
    await this.atomicWrite(this.file(game.id),JSON.stringify(game,null,2));
    return game;
  }

  async get(id:string){
    try{return parseGame(await readFile(this.file(id),'utf8'),id);}
    catch(primaryError){
      try{
        const recovered=parseGame(await readFile(this.backupFile(id),'utf8'),id);
        await this.atomicWrite(this.file(id),JSON.stringify(recovered,null,2));
        return recovered;
      }catch{throw new Error(`无法读取对局存档：${primaryError instanceof Error?primaryError.message:'未知错误'}`);}
    }
  }

  async list(){
    await mkdir(this.dir,{recursive:true});
    const files=(await readdir(this.dir)).filter(f=>/^[a-zA-Z0-9-]+\.json$/.test(f));
    const settled=await Promise.allSettled(files.map(f=>this.get(f.slice(0,-5))));
    return settled.flatMap(result=>result.status==='fulfilled'?[result.value]:[]).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
  }

  async canUndo(id:string){try{parseGame(await readFile(this.undoFile(id),'utf8'),id);return true;}catch{return false;}}

  async undo(id:string){
    let restored:GameState;
    try{restored=parseGame(await readFile(this.undoFile(id),'utf8'),id);}catch{throw new Error('没有可撤销的行动或阶段推进');}
    await this.save(restored);
    await rm(this.undoFile(id),{force:true});
    return restored;
  }

  async delete(id:string){await Promise.all([this.file(id),this.backupFile(id),this.undoFile(id)].map(file=>rm(file,{force:true})));}
}

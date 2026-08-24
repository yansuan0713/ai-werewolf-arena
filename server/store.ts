import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { GameState } from '../src/shared/types.js';

export class GameStore {
  constructor(private readonly dir=path.resolve(process.cwd(),'data','games')){}
  private file(id:string){if(!/^[a-zA-Z0-9-]+$/.test(id))throw new Error('非法对局 ID');return path.join(this.dir,`${id}.json`);}
  async save(game:GameState){await mkdir(this.dir,{recursive:true});game.updatedAt=new Date().toISOString();await writeFile(this.file(game.id),JSON.stringify(game,null,2),'utf8');return game;}
  async get(id:string){return JSON.parse(await readFile(this.file(id),'utf8')) as GameState;}
  async list(){await mkdir(this.dir,{recursive:true});const files=(await readdir(this.dir)).filter(f=>f.endsWith('.json'));const games=await Promise.all(files.map(f=>this.get(f.slice(0,-5))));return games.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));}
  async delete(id:string){await rm(this.file(id));}
}

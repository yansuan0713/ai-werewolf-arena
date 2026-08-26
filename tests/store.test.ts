import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach,describe,expect,it } from 'vitest';
import { GameStore } from '../server/store';
import { gameAt } from './helpers';
const dirs:string[]=[];afterEach(async()=>Promise.all(dirs.splice(0).map(d=>rm(d,{recursive:true,force:true}))));
describe('本地存档',()=>{it('保存后可恢复完整状态',async()=>{const dir=await mkdtemp(path.join(tmpdir(),'werewolf-'));dirs.push(dir);const store=new GameStore(dir),game=gameAt('night_wolf');game.publicLog.push({id:'1',timestamp:new Date().toISOString(),day:1,phase:'night_wolf',message:'测试'});await store.save(game);const restored=await store.get(game.id);expect(restored).toEqual(game);expect((await store.list())[0].id).toBe(game.id);});});
describe('存档容错',()=>{it('主存档损坏时自动从上一份有效备份恢复',async()=>{const dir=await mkdtemp(path.join(tmpdir(),'werewolf-recovery-'));dirs.push(dir);const store=new GameStore(dir),game=gameAt('night_wolf');game.title='可恢复版本';await store.save(game);game.title='较新版本';await store.save(game);const primary=path.join(dir,`${game.id}.json`);await writeFile(primary,'{ broken','utf8');const recovered=await store.get(game.id);expect(recovered.title).toBe('可恢复版本');expect(JSON.parse(await readFile(primary,'utf8')).title).toBe('可恢复版本');expect(await store.list()).toHaveLength(1);});});

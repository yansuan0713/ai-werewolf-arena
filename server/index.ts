import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { advanceGame, createGame, fullReport, generatePrompt, pendingPlayerIds, publicReport, submitAction } from '../src/game/engine.js';
import { parseReply } from '../src/game/parser.js';
import type { CreateGameInput, ParsedAction } from '../src/shared/types.js';
import { GameStore } from './store.js';

const app=express(), store=new GameStore(), port=Number(process.env.PORT||3001);
app.use(express.json({limit:'1mb'}));
const param=(value:string|string[])=>Array.isArray(value)?value[0]:value;
const asyncRoute=(fn:(req:express.Request,res:express.Response)=>Promise<unknown>)=>(req:express.Request,res:express.Response)=>{fn(req,res).catch((e:unknown)=>res.status(400).json({error:e instanceof Error?e.message:'未知错误'}));};
app.get('/api/health',(_req,res)=>res.json({ok:true}));
app.get('/api/games',asyncRoute(async(_req,res)=>res.json((await store.list()).map(g=>({...g,pendingPlayerIds:pendingPlayerIds(g)})))));
app.post('/api/games',asyncRoute(async(req,res)=>res.status(201).json(await store.save(createGame(req.body as CreateGameInput)))));
app.get('/api/games/:id',asyncRoute(async(req,res)=>{const g=await store.get(param(req.params.id));res.json({...g,pendingPlayerIds:pendingPlayerIds(g)});}));
app.delete('/api/games/:id',asyncRoute(async(req,res)=>{await store.delete(param(req.params.id));res.status(204).end();}));
app.post('/api/games/:id/prompt/:playerId',asyncRoute(async(req,res)=>{const playerId=param(req.params.playerId),g=await store.get(param(req.params.id)), prompt=generatePrompt(g,playerId);g.privateLogs[playerId].push({id:crypto.randomUUID(),timestamp:new Date().toISOString(),day:g.day,phase:g.phase,message:`已生成 ${g.phase} 阶段提示词`});await store.save(g);res.json({prompt});}));
app.post('/api/parse',asyncRoute(async(req,res)=>res.json({actions:parseReply(String(req.body.raw||''))})));
app.post('/api/games/:id/actions',asyncRoute(async(req,res)=>{const g=await store.get(param(req.params.id));res.json(await store.save(submitAction(g,String(req.body.playerId),req.body.action as ParsedAction,String(req.body.raw||''))));}));
app.post('/api/games/:id/advance',asyncRoute(async(req,res)=>{const g=await store.get(param(req.params.id));res.json(await store.save(advanceGame(g,req.body||{})));}));
app.get('/api/games/:id/export/public',asyncRoute(async(req,res)=>{const g=await store.get(param(req.params.id));res.setHeader('Content-Disposition',`attachment; filename="${g.id}-public.json"`);res.json(publicReport(g));}));
app.get('/api/games/:id/export/full',asyncRoute(async(req,res)=>{const g=await store.get(param(req.params.id));res.setHeader('Content-Disposition',`attachment; filename="${g.id}-full.json"`);res.json(fullReport(g));}));

const here=path.dirname(fileURLToPath(import.meta.url)),dist=path.resolve(here,'..','..','dist');app.use(express.static(dist));app.get(/^(?!\/api).*/,(_req,res)=>res.sendFile(path.join(dist,'index.html')));
app.listen(port,'127.0.0.1',()=>console.log(`AI Werewolf Arena: http://127.0.0.1:${port}`));

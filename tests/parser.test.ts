import { describe,expect,it } from 'vitest';
import { parseReply } from '../src/game/parser';
describe('回复解析',()=>{it('容忍 Markdown、空格与 HTML 实体',()=>{const r=parseReply('**【 击杀建议： 3 号 】** &lt;b&gt;分析&lt;/b&gt; 【投票：弃票】');expect(r).toMatchObject([{kind:'kill',targetSeat:3},{kind:'vote',abstain:true}]);});it('提取发言但不把普通文字当行动',()=>{expect(parseReply('我考虑投 2 号。')).toHaveLength(0);expect(parseReply('【公开发言】大家好')).toMatchObject([{kind:'speech',text:'大家好'}]);});});

import type { ParsedAction } from '../shared/types.js';

const decode = (value:string) => value.replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&amp;/gi,'&').replace(/&nbsp;/gi,' ');
type Pattern = [RegExp,(m:RegExpMatchArray)=>ParsedAction];
export interface ParseReplyOptions { loose?: boolean; }

export function parseReply(raw:string,options:ParseReplyOptions={}): ParsedAction[] {
  const text = decode(raw).replace(/<[^>]*>/g, ' ').replace(/\*\*/g, '').replace(/\s+/g, ' ');
  const results: ParsedAction[] = [];
  const strictSpans:Array<[number,number]>=[];
  const patterns: Pattern[] = [
    [/【\s*击杀(?:建议)?\s*[：:]\s*(\d+)\s*号?\s*】/g,m=>({kind:'kill',targetSeat:+m[1],matched:m[0]})],
    [/【\s*查验\s*[：:]\s*(\d+)\s*号?\s*】/g,m=>({kind:'inspect',targetSeat:+m[1],matched:m[0]})],
    [/【\s*使用解药\s*[：:]\s*(\d+)\s*号?\s*】/g,m=>({kind:'antidote',targetSeat:+m[1],matched:m[0]})],
    [/【\s*使用毒药\s*[：:]\s*(\d+)\s*号?\s*】/g,m=>({kind:'poison',targetSeat:+m[1],matched:m[0]})],
    [/【\s*不开药\s*】/g,m=>({kind:'no_medicine',matched:m[0]})],
    [/【\s*无夜间行动\s*】/g,m=>({kind:'none',matched:m[0]})],
    [/【\s*投票\s*[：:]\s*(弃票|\d+\s*号?)\s*】/g,m=>m[1].includes('弃票')?({kind:'vote',abstain:true,matched:m[0]}):({kind:'vote',targetSeat:+m[1].match(/\d+/)![0],matched:m[0]})],
    [/【\s*开枪\s*[：:]\s*(\d+)\s*号?\s*】/g,m=>({kind:'shoot',targetSeat:+m[1],matched:m[0]})],
    [/【\s*不开枪\s*】/g,m=>({kind:'no_shoot',matched:m[0]})],
    [/【\s*公开发言\s*】\s*(.*?)(?=【|$)/g,m=>({kind:'speech',text:m[1].trim(),matched:m[0]})],
    [/【\s*遗言\s*】\s*(.*?)(?=【|$)/g,m=>({kind:'last_words',text:m[1].trim(),matched:m[0]})],
  ];
  for (const [pattern, create] of patterns) for (const match of text.matchAll(pattern)) { results.push(create(match)); strictSpans.push([match.index,match.index+match[0].length]); }
  if(options.loose){
    const loosePatterns:Pattern[]=[
      [/【\s*击杀(?:建议)?\s+(\d+)\s*号?\s*】/g,m=>({kind:'kill',targetSeat:+m[1],matched:m[0]})],
      [/【\s*投票\s+(弃票|\d+\s*号?)\s*】/g,m=>m[1].includes('弃票')?({kind:'vote',abstain:true,matched:m[0]}):({kind:'vote',targetSeat:+m[1].match(/\d+/)![0],matched:m[0]})],
      [/(?<!【)投票\s*[：:]\s*(弃票|\d+\s*号?)/g,m=>m[1].includes('弃票')?({kind:'vote',abstain:true,matched:m[0]}):({kind:'vote',targetSeat:+m[1].match(/\d+/)![0],matched:m[0]})],
    ];
    for(const [pattern,create] of loosePatterns)for(const match of text.matchAll(pattern)){const start=match.index,end=start+match[0].length;if(!strictSpans.some(([a,b])=>start<b&&end>a))results.push(create(match));}
  }
  return results;
}

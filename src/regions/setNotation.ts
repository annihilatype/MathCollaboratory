// Set braces are display delimiters; fraction/exponent braces remain TeX groups.
// This runs only at the geometry entry point, before TeX groups become parentheses.
export function setConditions(latex:string):string|null {
  if(latex.length>500)throw new Error('Выражение слишком длинное (максимум 500 символов).');
  const s=latex.trim().replace(/\\(?:left|right)\s*/g,'').replace(/\\lbrace\b/g,'\\{').replace(/\\rbrace\b/g,'\\}');
  const escaped=s.startsWith('\\{'),start=escaped?2:s.startsWith('{')?1:0;
  if(!start)return null;
  const header=/^\s*z\s*(?::|\\colon\b)\s*/.exec(s.slice(start));
  if(!header){if(escaped)throw new Error('Запись области: {z: |z|<2}. Перед условиями нужны z и двоеточие.');return null;}
  const stack=[escaped?'display':'group'];let end=-1;
  for(let i=start;i<s.length;i++){
    if(s[i]==='\\'){
      if(s[i+1]==='{')stack.push('display');
      else if(s[i+1]==='}'){
        if(stack.pop()!=='display')throw new Error('Проверьте фигурные скобки множества и групп дробей.');
      }else {const command=/^\\[a-zA-Z]+/.exec(s.slice(i));i+=command?command[0].length-1:1;continue;}
      if(stack.length===0){end=i; if(s.slice(i+2).trim())throw new Error('После закрывающей скобки множества не должно быть других выражений.');break;}i++;continue;
    }
    if(s[i]==='{')stack.push('group');
    if(s[i]==='}'){
      if(stack.pop()!=='group')throw new Error('Проверьте фигурные скобки множества и групп дробей.');
      if(stack.length===0){end=i;if(s.slice(i+1).trim())throw new Error('После множества не должно быть других выражений.');break;}
    }
  }
  if(end<0)throw new Error('Не закрыта фигурная скобка множества.');
  const body=s.slice(start+header[0].length,end),parts:string[]=[];let depth=0,last=0;
  for(let i=0;i<body.length;i++){
    if(body[i]==='\\'){const command=/^\\[a-zA-Z]+/.exec(body.slice(i));i+=command?command[0].length-1:1;continue;}
    if('({['.includes(body[i]))depth++;
    if(')}]'.includes(body[i]))depth--;
    if(body[i]===','&&depth===0){parts.push(body.slice(last,i));last=i+1;}
  }
  parts.push(body.slice(last));
  if(parts.some(p=>!p.trim()))throw new Error('После двоеточия и запятой нужны условия области.');
  if(parts.length>2)throw new Error('Поддерживается пересечение двух условий через запятую или and.');
  return parts.map(p=>'('+p+')').join(' and ');
}

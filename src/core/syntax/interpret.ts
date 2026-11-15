import {isEuler,walkAst} from './ast';
import type {MathNode} from 'mathjs';
import {canonicalName} from '../operations';
import type {MathDocument} from './document';
import type {SyntaxReference,DomainRule,DomainCondition,FunctionFeature,DomainDescription,GeometryDefinition,MathematicalObject} from '../semantics';
function geometryDefinition(root:MathNode,path=''):GeometryDefinition {
 const n=root as MathNode&{content:MathNode;op:string;args:MathNode[];name:string;params:MathNode[];conditionals:string[]};
 const ref=(node:MathNode,child:string):SyntaxReference=>({path:path?path+'.'+child:child,expression:node.toString()});
 if(root.type==='ParenthesisNode')return geometryDefinition(n.content,path?path+'.content':'content');
 if(root.type==='OperatorNode'&&['and','or'].includes(n.op))return {kind:n.op==='and'?'intersection':'union',operands:n.args.map((a,i)=>geometryDefinition(a,path?path+`.args[${i}]`:`args[${i}]`))};
 if(root.type==='OperatorNode'&&['==','!=','<','<=','>','>='].includes(n.op)&&n.args.length===2){
  if(n.op==='!='&&n.args[0].type==='SymbolNode'&&(n.args[0] as MathNode&{name:string}).name==='z')return {kind:'excluded-point',point:ref(n.args[1],'args[1]')};
  return {kind:'relation',operator:n.op,left:ref(n.args[0],'args[0]'),right:ref(n.args[1],'args[1]')};
 }
 if(root.type==='RelationalNode')return {kind:'comparison-chain',operators:[...n.conditionals],terms:n.params.map((v,i)=>ref(v,`params[${i}]`)),convention:'region-language-v051'};
 if(root.type==='FunctionNode'&&n.name==='excludeSegment'&&n.args.length===3)return {kind:'excluded-segment',start:ref(n.args[1],'args[1]'),end:ref(n.args[2],'args[2]')};
 if(root.type==='FunctionNode'&&n.name==='segment'&&n.args.length===2)return {kind:'segment',start:ref(n.args[0],'args[0]'),end:ref(n.args[1],'args[1]')};
 return {kind:'value',term:{path:path||'$',expression:root.toString()}};
}
export interface DomainTest {rule:DomainRule;nodes:MathNode[]}
export function interpretSemantics(document:MathDocument):{object:MathematicalObject;tests:DomainTest[]} {
 const conditions:DomainCondition[]=[],features:FunctionFeature[]=[],tests:DomainTest[]=[];
 const real=document.source.role==='real',reference=(n:MathNode,path:string):SyntaxReference=>({path:path||'$',expression:n.toString()});
 const descriptions:Record<DomainRule,string>={nonzero:'Аргумент должен быть ненулевым.',positive:'Аргумент должен быть положительным.',nonnegative:'Аргумент должен быть неотрицательным.','unit-interval':'Аргумент должен лежать в [−1,1].','defined-power':'Степень должна быть определена в выбранном числовом поле.','nonzero-cos':'Косинус аргумента должен быть ненулевым.','nonzero-cosh':'Гиперболический косинус аргумента должен быть ненулевым.','nonzero-atan-denominator':'Для atan исключены +i и −i.'};
 function condition(rule:DomainRule,nodes:MathNode[],path:string,offset=0){tests.push({rule,nodes});conditions.push({rule,operands:nodes.map((n,i)=>reference(n,(path?path+'.':'')+'args['+(i+offset)+']')),description:descriptions[rule]});}
 walkAst(document.ast,(node,path)=>{const n=node as MathNode&{op:string;args:MathNode[];name:string};
  if(node.type==='OperatorNode'&&n.op==='/'){condition('nonzero',[n.args[1]],path,1);features.push({kind:'pole-candidate',at:reference(node,path),description:'Нули знаменателя; сокращение не восстанавливает исключённые точки исходной записи.'});}
  if(node.type==='OperatorNode'&&n.op==='^'&&!isEuler(n.args[0]))condition('defined-power',n.args,path);
  if(node.type!=='FunctionNode')return;const name=canonicalName(n.name),a=n.args[0];if(!a)return;
  if(['ln','log','arg'].includes(name))condition(real&&name!=='arg'?'positive':'nonzero',[a],path);
  if(name==='sqrt'&&real)condition('nonnegative',[a],path);
  if(['asin','acos'].includes(name)&&real)condition('unit-interval',[a],path);
  if(name==='tan')condition('nonzero-cos',[a],path);
  if(name==='tanh'&&!real)condition('nonzero-cosh',[a],path);
  if(name==='atan'&&!real)condition('nonzero-atan-denominator',[a],path);
  if(!real&&['ln','log','sqrt','asin','acos','atan'].includes(name))features.push({kind:'branch-cut',at:reference(node,path),description:'Главная ветвь; разрез не равен автоматически исключению всех граничных значений из области вычисления.'});
  if(['conj','Re','Im','abs','arg'].includes(name)&&!real)features.push({kind:'non-holomorphic',at:reference(node,path),description:'Комплексная дифференцируемость на открытой области не предполагается.'});
  if(['floor','ceil','round'].includes(name))features.push({kind:'discontinuity',at:reference(node,path),description:'Разрывы округления.'});
 });
 const domain:DomainDescription={purpose:'evaluation-domain',coverage:document.source.role==='geometry'?'partial':'complete-constraints',conditions,features,limitations:['Условия извлечены структурно; множество их решений символически не вычисляется.','Проверка значений использует float64 и не является интервальным доказательством.']};
 const object:MathematicalObject=document.source.role==='geometry'?{kind:'geometry',variable:'z',parameters:document.parameters,definition:geometryDefinition(document.ast),domain}:{kind:'scalar',field:real?'real':'complex',variables:document.variables,parameters:document.parameters,domain};
 return {object,tests};
}

export type DiagnosticKind='syntax'|'operation'|'domain'|'preimages'|'uncertain'|'budget'|'numeric';
export class MathDiagnostic extends Error {
  constructor(public readonly kind:DiagnosticKind,public readonly code:string,message:string){super(message);this.name='MathDiagnostic';}
}
export interface Diagnostic {kind:DiagnosticKind;code:string;message:string}
export const diagnosis=(kind:DiagnosticKind,code:string,message:string):Diagnostic=>({kind,code,message});

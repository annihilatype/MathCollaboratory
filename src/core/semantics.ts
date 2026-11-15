export interface SyntaxReference {path:string;expression:string}
export type DomainRule='nonzero'|'positive'|'nonnegative'|'unit-interval'|'defined-power'|'nonzero-cos'|'nonzero-cosh'|'nonzero-atan-denominator';
export interface DomainCondition {rule:DomainRule;operands:SyntaxReference[];description:string}
export interface FunctionFeature {kind:'pole-candidate'|'branch-cut'|'non-holomorphic'|'discontinuity';at:SyntaxReference;description:string}
export interface DomainDescription {purpose:'evaluation-domain';coverage:'complete-constraints'|'partial';conditions:DomainCondition[];features:FunctionFeature[];limitations:string[]}
export type GeometryDefinition=
 | {kind:'intersection'|'union';operands:GeometryDefinition[]}
 | {kind:'relation';operator:string;left:SyntaxReference;right:SyntaxReference}
 | {kind:'comparison-chain';operators:string[];terms:SyntaxReference[];convention:'region-language-v051'}
 | {kind:'excluded-point';point:SyntaxReference}
 | {kind:'excluded-segment'|'segment';start:SyntaxReference;end:SyntaxReference}
 | {kind:'value';term:SyntaxReference};
/** Open semantic layer: future systems/ODEs extend this map, not the parser AST. */
export interface SemanticObjectBase {kind:string;domain:DomainDescription}
export interface MathematicalObjects {
 scalar:{kind:'scalar';field:'real'|'complex';variables:readonly string[];parameters:readonly string[];domain:DomainDescription};
 geometry:{kind:'geometry';variable:'z';parameters:readonly string[];definition:GeometryDefinition;domain:DomainDescription};
}
export type MathematicalObject=MathematicalObjects[keyof MathematicalObjects]&SemanticObjectBase;

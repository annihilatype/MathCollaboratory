import {it,expect} from 'vitest';
import {parseExpression} from '../math/expression';
import {evaluateComplex,complexSource} from '../complex/math';
it('evaluates compact MathLive fraction and root exports in both engines',()=>{
 for(const [source,value] of [['\\frac12',.5],['\\frac{1}{2}',.5],['\\sqrt4',2],['\\sqrt{4}',2],['\\sqrt{\\frac14}',.5],['\\frac1{\\sqrt4}',.5]] as const){expect(parseExpression(source).evaluate(0,{})).toBeCloseTo(value,14);expect(evaluateComplex(complexSource(source)).re).toBeCloseTo(value,14);}
});

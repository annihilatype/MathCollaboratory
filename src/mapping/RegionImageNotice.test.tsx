import {it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {RegionImageNotice} from './RegionImageNotice';
import {approximate,uncertain} from '../core/results';
import {compileIntervalExpression,encloseExpression} from '../core/interval/program';
import {complexInterval} from '../core/interval/index';
import {diagnosis} from '../core/diagnostics';
it('shows a compact warning for approximate/uncertain results and omits it for actual interval confirmation',()=>{
 for(const precision of [approximate(1),uncertain(diagnosis('uncertain','test','boundary'))])expect(renderToStaticMarkup(<RegionImageNotice results={[]} hasLines={false} hasNumericalObjects precision={precision}/>)).toContain('Приближённое построение');
 const compiled=compileIntervalExpression('1');if(!compiled.ok)throw new Error(compiled.diagnostic.message);const confirmed=encloseExpression(compiled.value,complexInterval.point(0));expect(confirmed.kind).toBe('interval-confirmed');expect(renderToStaticMarkup(<RegionImageNotice results={[]} hasLines={false} hasNumericalObjects precision={confirmed}/>)).not.toContain('Приближённое построение');
});

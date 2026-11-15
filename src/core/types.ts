/** Mathematical coordinates and inputs; no rendering or application state. */
export interface ComplexCoordinate {re:number;im:number}
export type RealScope=Readonly<Record<string,number>>;
/** left, top, right, bottom in mathematical coordinates. */
export type Viewport=[number,number,number,number];

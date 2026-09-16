export type Color = 'white' | 'black';
export type PieceType = 'queen' | 'ant' | 'grasshopper' | 'spider' | 'beetle' | 'ladybug';
export type Piece = { readonly type: PieceType; readonly color: Color };

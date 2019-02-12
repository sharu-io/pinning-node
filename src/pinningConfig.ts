export interface PinningConfig{
    mode: Mode,
    ipfsAllowCircuitRelay?: boolean
    wallet?: string
}
export enum Mode {
    FullNode, HalfNode, Personal
}
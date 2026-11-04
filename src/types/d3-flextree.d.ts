// Minimal typings for d3-flextree 2.x (the package ships none).
declare module 'd3-flextree' {
  export interface FlexHierarchyNode<T> {
    data: T;
    depth: number;
    x: number;
    y: number;
    parent: FlexHierarchyNode<T> | null;
    children?: FlexHierarchyNode<T>[];
    readonly size: [number, number];
    each(cb: (node: FlexHierarchyNode<T>) => void): this;
    descendants(): FlexHierarchyNode<T>[];
  }
  export interface FlexTreeLayout<T> {
    (root: FlexHierarchyNode<T>): FlexHierarchyNode<T>;
    hierarchy(data: T, children?: (d: T) => T[] | null | undefined): FlexHierarchyNode<T>;
  }
  export function flextree<T>(options?: {
    nodeSize?: (node: FlexHierarchyNode<T>) => [number, number];
    spacing?: number | ((a: FlexHierarchyNode<T>, b: FlexHierarchyNode<T>) => number);
    children?: (d: T) => T[] | null | undefined;
  }): FlexTreeLayout<T>;
}

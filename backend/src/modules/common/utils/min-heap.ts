/**
 * Min-Heap genérico usado como cola de prioridad en el algoritmo A*.
 * Complejidad: push O(log n), pop O(log n).
 */
export class MinHeap<T> {
  private data: T[] = [];

  constructor(private readonly comparar: (a: T, b: T) => number) {}

  get size(): number {
    return this.data.length;
  }

  push(elemento: T): void {
    this.data.push(elemento);
    this.subirBurbuja(this.data.length - 1);
  }

  pop(): T | undefined {
    if (this.data.length === 0) return undefined;
    const min = this.data[0];
    const ultimo = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = ultimo;
      this.bajarBurbuja(0);
    }
    return min;
  }

  private subirBurbuja(i: number): void {
    while (i > 0) {
      const padre = Math.floor((i - 1) / 2);
      if (this.comparar(this.data[i], this.data[padre]) < 0) {
        [this.data[i], this.data[padre]] = [this.data[padre], this.data[i]];
        i = padre;
      } else {
        break;
      }
    }
  }

  private bajarBurbuja(i: number): void {
    const n = this.data.length;
    while (true) {
      let menor = i;
      const izq = 2 * i + 1;
      const der = 2 * i + 2;
      if (izq < n && this.comparar(this.data[izq], this.data[menor]) < 0) menor = izq;
      if (der < n && this.comparar(this.data[der], this.data[menor]) < 0) menor = der;
      if (menor === i) break;
      [this.data[i], this.data[menor]] = [this.data[menor], this.data[i]];
      i = menor;
    }
  }
}

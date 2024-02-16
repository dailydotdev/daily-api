export const isPerfectSquare = (n: number) => {
  return Number.isInteger(Math.sqrt(n));
};

// Number is Fibonacci if (5*n^2 + 4) or (5*n^2 - 4) is a perfect square
export const isFibonacci = (num: number) => {
  const x = 5 * Math.pow(num, 2);
  return isPerfectSquare(x + 4) || isPerfectSquare(x - 4);
};

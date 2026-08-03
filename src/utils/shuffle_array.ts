export function shuffleArray(array: any[]) {
  const result = [...array];

  for (let i: number = result.length - 1; i > 0; i--) {
    const randomBuffer = new Uint32Array(1);
    crypto.getRandomValues(randomBuffer);

    const j = randomBuffer[0] % (i + 1);

    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }

  return result;
}

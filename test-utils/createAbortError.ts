export const createAbortError = () => {
  const error = new Error('aborted');
  error.name = 'AbortError';
  return error;
};

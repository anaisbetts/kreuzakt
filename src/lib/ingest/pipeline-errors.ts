export function isDuplicateFileHashConstraintError(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes("UNIQUE constraint failed: documents.file_hash")
  );
}

/** Generator that calls a faker.js method by dot-path, e.g. "person.firstName" */
export type FakerGenerator = {
  type: "faker";
  method: string;
  params?: Record<string, unknown>;
};

/** Pick a random value from already-inserted rows of a parent table */
export type ForeignKeyGenerator = {
  type: "foreignKey";
  table: string;
  column: string;
};

/** Auto-incrementing integer */
export type SequenceGenerator = {
  type: "sequence";
  start?: number;
  step?: number;
};

/** Pick uniformly from a fixed list */
export type OneOfGenerator = {
  type: "oneOf";
  values: unknown[];
};

/** Pick from a weighted list */
export type WeightedOneOfGenerator = {
  type: "weightedOneOf";
  options: { value: unknown; weight: number }[];
};

/** Always NULL */
export type NullGenerator = {
  type: "null";
};

export type ColumnGenerator =
  | FakerGenerator
  | ForeignKeyGenerator
  | SequenceGenerator
  | OneOfGenerator
  | WeightedOneOfGenerator
  | NullGenerator;

export type ColumnGenConfig = {
  columnName: string;
  generator: ColumnGenerator;
  /** 0–1 probability of generating NULL instead (only for nullable columns) */
  nullProbability?: number;
};

export type TableGenConfig = {
  tableName: string;
  rowCount: number;
  columns: ColumnGenConfig[];
};

export type DataGenConfig = {
  tables: TableGenConfig[];
};

export type DataGenResult = {
  success: boolean;
  tablesInserted: { tableName: string; rowCount: number }[];
  errors: { tableName: string; error: string }[];
  totalRows: number;
  durationMs: number;
};

/** Per-table progress during execution */
export type TableProgress = {
  tableName: string;
  status: "pending" | "generating" | "inserting" | "done" | "error";
  rowCount: number;
  error?: string;
  elapsedMs?: number;
};

export type ExecutionProgress = {
  tables: TableProgress[];
  currentTable: string | null;
};

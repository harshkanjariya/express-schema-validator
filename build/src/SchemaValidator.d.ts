import e from 'express';
export type Schema = PrimitiveSchema | ArraySchema | ObjectSchema | EnumSchema;
export type PrimitiveSchema = NumericSchema | StringSchema | BooleanSchema;
export type NumericSchema = {
    name: string;
    type: 'int' | 'float';
    min?: number;
    max?: number;
    optional?: boolean;
};
export type StringSchema = {
    name: string;
    type: 'string';
    length?: number;
    min_length?: number;
    max_length?: number;
    optional?: boolean;
};
export type BooleanSchema = {
    name: string;
    type: 'boolean';
    allowNumeric?: boolean;
    optional?: boolean;
};
export type EnumSchema = {
    name: string;
    type: 'enum';
    symbols: string[] | number[];
    optional?: boolean;
};
export type ArraySchema = {
    name: string;
    type: 'array';
    elementType: Schema;
    optional?: boolean;
};
export type ObjectSchema = {
    name: string;
    type: 'object';
    fields: Schema[];
    optional?: boolean;
};
export type SchemaErrorCallback = (errors: SchemaError[], req: e.Request, res: e.Response) => boolean | void;
export type SchemaError = {
    name: string;
    type: 'int' | 'float' | 'string' | 'boolean' | 'enum' | 'array' | 'object';
    value: any;
    description: string;
};
/**
 * schema validator middleware
 * @param {Schema[]} schema
 * @param {SchemaErrorCallback} onError
 * @return {any}
 */
export declare function SchemaValidator(schema: Schema[], onError?: SchemaErrorCallback): (req: e.Request, res: e.Response, next: Function) => void;
declare global {
    export namespace Express {
        interface Request {
            data: {
                [key: string]: any;
            };
        }
    }
}

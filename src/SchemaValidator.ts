import e from 'express';
import _ from 'lodash';

export type Schema = PrimitiveSchema | ArraySchema | ObjectSchema | EnumSchema;

export type PrimitiveSchema = NumericSchema | StringSchema | BooleanSchema;

export type NumericSchema = {
    name: string;
    type: 'int' | 'float';
    min?: number;
    max?: number;
    optional?: boolean;
}

export type StringSchema = {
    name: string;
    type: 'string';
    length?: number;
    min_length?: number;
    max_length?: number;
    optional?: boolean;
}

export type BooleanSchema = {
    name: string;
    type: 'boolean';
    allowNumeric?: boolean;
    optional?: boolean;
}

export type EnumSchema = {
    name: string;
    type: 'enum';
    symbols: string[] | number[];
    optional?: boolean;
}

export type ArraySchema = {
    name: string;
    type: 'array';
    elementType: Schema;
    optional?: boolean;
}

export type ObjectSchema = {
    name: string;
    type: 'object';
    fields: Schema[];
    optional?: boolean;
}

export type SchemaErrorCallback = (errors: SchemaError[], req: e.Request, res: e.Response) => boolean | void;

export type SchemaError = {
    name: string;
    type: 'int' | 'float' | 'string' | 'boolean' | 'enum' | 'array' | 'object';
    value: any;
    description: string;
}

/**
 * schema validator middleware
 * @param {Schema[]} schema
 * @param {SchemaErrorCallback} onError
 * @return {any}
 */
export function SchemaValidator(schema: Schema[], onError?: SchemaErrorCallback) {
    return (req: e.Request, res: e.Response, next: Function) => {
        const reqData = mergeReqData(req);
        const errors: SchemaError[] = [];
        const includeErrors = process.env.DEBUG === 'true';

        const doNext = isValid(schema, reqData, errors) || (onError && onError(errors, req, res));

        if (!doNext) {
            const returningErrors = includeErrors ? errors : undefined;
            return res.status(400)
                    .send({
                        code: 400,
                        error_code: 'EBADPARAM',
                        message: 'bad request',
                        data: returningErrors,
                    }).statusMessage = 'bad request';
        }

        req['data'] = reqData;
        next();
    };
}

const mergeReqData = (req: e.Request) => {
    const reqData = {};
    _.assign(reqData, req.params, req.query, req.body);
    return reqData;
};

const pushError = (errors: any[], path: string, name: string, type: string, value: any, desc: string) => {
    /* istanbul ignore next-branch */
    const _name = !path ? name : (path.endsWith('[') ? `${path}${name}]` : `${path}.${name}`);
    errors.push({
        name: _name,
        type: type,
        value: value,
        description: desc,
    });
};

const NumberTypeChecker = (schema: NumericSchema, data: any, errors: SchemaError[], path: string): boolean => {
    const value = data[schema.name];
    const parsedValue = schema.type == 'int' ? parseInt(value) : parseFloat(value);

    if (isNaN(parsedValue)) {
        pushError(errors, path, schema.name, schema.type, value, 'not a number');
        return false;
    }

    if ((schema.min || schema.min === 0) && parsedValue < schema.min) {
        pushError(errors, path, schema.name, schema.type, value, 'less than min');
        return false;
    }

    if ((schema.max || schema.max === 0) && parsedValue > schema.max) {
        pushError(errors, path, schema.name, schema.type, value, 'greater than max');
        return false;
    }

    data[schema.name] = parsedValue;
    return true;
};

interface TypeCheckerType {
    [key: string]: (schema: any, data: any, errors: SchemaError[], path: string) => boolean;
}

const TypeChecker: TypeCheckerType = {
    'int': NumberTypeChecker,
    'float': NumberTypeChecker,

    'string': (schema: StringSchema, data: any, errors: SchemaError[], path: string): boolean => {
        let value = data[schema.name];

        if (typeof value != 'string') {
            value = JSON.stringify(value);
        }

        if (schema.length && value.length != schema.length) {
            pushError(errors, path, schema.name, schema.type, value, 'length not match');
            return false;
        }

        if ((schema.min_length || schema.min_length === 0) && value.length < schema.min_length) {
            pushError(errors, path, schema.name, schema.type, value, 'length less than min');
            return false;
        }

        if ((schema.max_length || schema.max_length === 0) && value.length > schema.max_length) {
            pushError(errors, path, schema.name, schema.type, value, 'length greater than max');
            return false;
        }
        data[schema.name] = value;

        return true;
    },

    'boolean': (schema: BooleanSchema, data: any, errors: SchemaError[], path: string): boolean => {
        const value = data[schema.name];

        const allowedValues: any[] = [true, false, 'true', 'false'];
        if (schema.allowNumeric !== false) {
            allowedValues.push(0, 1, '0', '1');
        }

        if (!allowedValues.includes(value)) {
            pushError(errors, path, schema.name, schema.type, value, 'not boolean');
            return false;
        }
        data[schema.name] = value === 'true' || value === '1' || value;

        return true;
    },

    'enum': (schema: EnumSchema, data: any, errors: SchemaError[], path: string): boolean => {
        const value = data[schema.name];

        if (typeof value != 'number' && typeof value != 'string') {
            pushError(errors, path, schema.name, schema.type, value, 'not number or string');
            return false;
        }

        const valid = schema.symbols.includes(<never>value);
        if (!valid) {
            pushError(errors, path, schema.name, schema.type, value,
                `invalid symbol, valid symbols : [${schema.symbols.join(', ')}]`);
            return false;
        }

        return true;
    },

    'array': (schema: ArraySchema, data: any, errors: SchemaError[], path: string): boolean => {
        let value = data[schema.name];
        let valid = true;

        if (!Array.isArray(value)) {
            if (typeof value == 'string') {
                try {
                    value = JSON.parse(value);
                } catch {
                }
            }
            if (!Array.isArray(value)) {
                pushError(errors, path, schema.name, schema.type, value, 'array expected');
                return false;
            }
            data[schema.name] = value;
        }

        const elementSchema: Schema = <Schema>{};
        _.assign(elementSchema, schema.elementType);
        for (let i = 0; i < value.length; i++) {
            elementSchema.name = `${i}`;
            valid &&= TypeChecker[schema.elementType.type](
                elementSchema,
                value,
                errors,
                path ? `${path}.${schema.name}[` : `${schema.name}[`,
            );
        }

        return valid;
    },

    'object': (schema: ObjectSchema, data: any, errors: SchemaError[], path: string): boolean => {
        let value = data[schema.name];

        if (typeof value != 'object') {
            if (typeof value == 'string') {
                try {
                    value = JSON.parse(value);
                } catch {
                }
            }
            if (typeof value != 'object') {
                pushError(errors, path, schema.name, schema.type, value, 'object expected');
                return false;
            }
            data[schema.name] = value;
        }

        /* istanbul ignore next-branch */
        const _path = !path ? schema.name : (path.endsWith('[') ? `${path}${schema.name}]` : `${path}.${schema.name}`);
        return isValid(schema.fields, value, errors, _path);
    },
};

/**
 * Schema is valid
 * @param {Schema[]} schema
 * @param {Object} data
 * @param {SchemaError[]} errors
 * @param {string} [path='']
 * @return {boolean}
 */
function isValid(schema: Schema | Schema[], data: any, errors: SchemaError[], path = ''): boolean {
    if (Array.isArray(schema)) {
        let valid = true;
        for (const entry of schema) {
            valid &&= isValid(entry, data, errors, path);
        }
        return valid;
    }

    if (!(schema.name in data) ||
        data[schema.name] === null ||
        data[schema.name] === undefined
    ) {
        schema.optional || pushError(errors, path, schema.name, schema.type, data[schema.name], 'not found');
        return schema.optional || false;
    }

    return TypeChecker[schema.type](schema, data, errors, path);
}

declare global {
    export namespace Express {
        export interface Request {
            data?: {[key: string]: any};
        }
    }
}

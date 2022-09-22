"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchemaValidator = void 0;
const lodash_1 = __importDefault(require("lodash"));
/**
 * schema validator middleware
 * @param {Schema[]} schema
 * @param {SchemaErrorCallback} onError
 * @return {any}
 */
function SchemaValidator(schema, onError) {
    return (req, res, next) => {
        const reqData = mergeReqData(req);
        const errors = [];
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
exports.SchemaValidator = SchemaValidator;
const mergeReqData = (req) => {
    const reqData = {};
    lodash_1.default.assign(reqData, req.params, req.query, req.body);
    return reqData;
};
const pushError = (errors, path, name, type, value, desc) => {
    /* istanbul ignore next-branch */
    const _name = !path ? name : (path.endsWith('[') ? `${path}${name}]` : `${path}.${name}`);
    errors.push({
        name: _name,
        type: type,
        value: value,
        description: desc,
    });
};
const NumberTypeChecker = (schema, data, errors, path) => {
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
const TypeChecker = {
    'int': NumberTypeChecker,
    'float': NumberTypeChecker,
    'string': (schema, data, errors, path) => {
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
    'boolean': (schema, data, errors, path) => {
        const value = data[schema.name];
        const allowedValues = [true, false, 'true', 'false'];
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
    'enum': (schema, data, errors, path) => {
        const value = data[schema.name];
        if (typeof value != 'number' && typeof value != 'string') {
            pushError(errors, path, schema.name, schema.type, value, 'not number or string');
            return false;
        }
        const valid = schema.symbols.includes(value);
        if (!valid) {
            pushError(errors, path, schema.name, schema.type, value, `invalid symbol, valid symbols : [${schema.symbols.join(', ')}]`);
            return false;
        }
        return true;
    },
    'array': (schema, data, errors, path) => {
        let value = data[schema.name];
        let valid = true;
        if (!Array.isArray(value)) {
            if (typeof value == 'string') {
                try {
                    value = JSON.parse(value);
                }
                catch (_a) {
                }
            }
            if (!Array.isArray(value)) {
                pushError(errors, path, schema.name, schema.type, value, 'array expected');
                return false;
            }
            data[schema.name] = value;
        }
        const elementSchema = {};
        lodash_1.default.assign(elementSchema, schema.elementType);
        for (let i = 0; i < value.length; i++) {
            elementSchema.name = `${i}`;
            valid && (valid = TypeChecker[schema.elementType.type](elementSchema, value, errors, path ? `${path}.${schema.name}[` : `${schema.name}[`));
        }
        return valid;
    },
    'object': (schema, data, errors, path) => {
        let value = data[schema.name];
        if (typeof value != 'object') {
            if (typeof value == 'string') {
                try {
                    value = JSON.parse(value);
                }
                catch (_a) {
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
function isValid(schema, data, errors, path = '') {
    if (Array.isArray(schema)) {
        let valid = true;
        for (const entry of schema) {
            valid && (valid = isValid(entry, data, errors, path));
        }
        return valid;
    }
    if (!(schema.name in data) ||
        data[schema.name] === null ||
        data[schema.name] === undefined) {
        schema.optional || pushError(errors, path, schema.name, schema.type, data[schema.name], 'not found');
        return schema.optional || false;
    }
    return TypeChecker[schema.type](schema, data, errors, path);
}

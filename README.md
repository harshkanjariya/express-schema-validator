# Express Schema Validator
the schema validator that can be used as middleware for express requests.

### install
```shell
npm install eschema-validator
```

#### Usage
```javascript
const express = require('express');
const SchemaValidator = require('eschema-validator');
const app = express();

const createUserValidator = SchemaValidator([
    {name: 'first_name', type: 'string'},
    {name: 'last_name', type: 'string'},
    {name: 'email', type: 'string', optional: false},
]);
app.post('/create-user', createUserValidator, (req, res) => {
    const data = req.data;
    // ... create user
});
```

Supported Types :
* int
* float
* string
* boolean
* array
* object
* enum

If request body does not match the schema than there is option for error handling
```javascript
const validator = SchemaValidator([
    // schema
], (errors, req, res) => {
    res.status(400);
    res.send({
        success: false,
        message: 'invalid request body'
    });
    return false; // return true if you want to call next function
});
```

[Note:- if validation is successful then req.body, req.query and req.params will be merged into req.data]



Examples for supported types :

#### int
optional fields: min, max
```javascript
const validator = SchemaValidator([
    {name: 'limit', type: 'int', min: 1, optional: false}
]);
```

#### float
optional fields: min, max
```javascript
const validator = SchemaValidator([
    {name: 'amount', type: 'float', min: 10.00, max: 100.00}
]);
```

#### string
optional fields: min_length, max_length
```javascript
const validator = SchemaValidator([
    {name: 'amount', type: 'float', min_length: 5, max_length: 100}
]);
```

#### boolean
optional fields: allowNumeric
```javascript
const validator = SchemaValidator([
    {name: 'isChecked', type: 'boolean'},                       // supported values 'true', 'false', true, false
    {name: 'isSelected', type: 'boolean', allowNumeric: true},  // supported values 'true', 'false', true, false, '1', '0', 1, 0, 
]);
```

#### array
required fields: elementType
```javascript
const validator = SchemaValidator([
    {
        name: 'selected_indices',
        type: 'array',
        elementType: {name: '', type: 'int'}
    }
]);
```

#### object
required fields: fields
```javascript
const validator = SchemaValidator([
    {
        name: 'user',
        type: 'object',
        fields: [
            {name: 'first_name', type: 'string'},
            {name: 'last_name', type: 'string'},
        ]
    }
]);
```

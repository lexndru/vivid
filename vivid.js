// Copyright (c) 2024 Alexandru Catrina <alex@codeissues.net>
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

const OPCODE_NULL = 0x00; // internal only

export const OPCODE_LAYOUT = 0x08;

export const OPCODE_HTML_FOLLOW = 0x31;
export const OPCODE_HTML_SELECT = 0x32;
export const OPCODE_HTML_BUNDLE = 0x33;

export const OPCODE_TEXT_EXTRACT = 0x51;
export const OPCODE_TEXT_REPLACE = 0x52;
export const OPCODE_TEXT_REMOVE = 0x53;
export const OPCODE_TEXT_INSERT = 0x54;
export const OPCODE_TEXT_GLUE = 0x55;
export const OPCODE_TEXT_DROP = 0x56;
export const OPCODE_TEXT_KEEP = 0x57;

export const OPCODE_CSS_STYLE = 0x91;

export const OPCODE_PROMPT = 0xDD;
export const OPCODE_LABEL = 0xAC;

const TOKEN_COMMENT = `#`;

export const TOKEN_LAYOUT = `layout`; // layout vivid x.y

export const TOKEN_HTML_FOLLOW = `follow`; // follow xpath
export const TOKEN_HTML_SELECT = `select`; // select css.selector
export const TOKEN_HTML_BUNDLE = `bundle`; // bundle xpath ~ e.g. bundle //a[@container]

export const TOKEN_TEXT_EXTRACT = `extract`; // extract regex
export const TOKEN_TEXT_REPLACE = `replace`; // replace regex/text text
export const TOKEN_TEXT_REMOVE = `remove`;   // remove text
export const TOKEN_TEXT_INSERT = `insert`;   // insert placeholder text-with-placeholder
export const TOKEN_TEXT_GLUE = `glue`;       // glue text-to-glue-as-prefix
export const TOKEN_TEXT_DROP = `drop`;       // drop regex
export const TOKEN_TEXT_KEEP = `keep`;       // keep regex

export const TOKEN_CSS_STYLE = `style`; // style css property

export const TOKEN_PROMPT = `prompt`; // prompt event or action ~ e.g. prompt download
export const TOKEN_LABEL = `label`;   // label friendly name

const EOL = /\r?\n/; // on windows it's \r\n

// *****************************************************************************

const directives = Object.freeze({
    [TOKEN_LAYOUT]: OPCODE_LAYOUT,

    [TOKEN_HTML_BUNDLE]: OPCODE_HTML_BUNDLE,
    [TOKEN_HTML_FOLLOW]: OPCODE_HTML_FOLLOW,
    [TOKEN_HTML_SELECT]: OPCODE_HTML_SELECT,

    [TOKEN_TEXT_EXTRACT]: OPCODE_TEXT_EXTRACT,
    [TOKEN_TEXT_REPLACE]: OPCODE_TEXT_REPLACE,
    [TOKEN_TEXT_REMOVE]: OPCODE_TEXT_REMOVE,
    [TOKEN_TEXT_INSERT]: OPCODE_TEXT_INSERT,
    [TOKEN_TEXT_GLUE]: OPCODE_TEXT_GLUE,
    [TOKEN_TEXT_DROP]: OPCODE_TEXT_DROP,
    [TOKEN_TEXT_KEEP]: OPCODE_TEXT_KEEP,

    [TOKEN_CSS_STYLE]: OPCODE_CSS_STYLE,

    [TOKEN_PROMPT]: OPCODE_PROMPT,
    [TOKEN_LABEL]: OPCODE_LABEL,
});

/**
 * Parse the layout/script text into JSON to be compiled or analyzed
 * 
 * @param {string} script
 * @returns {object[]}
 */
export function Parse(script) {
    const lines = script.split(EOL);
    const layout = new Array(lines.length).fill(null);

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.charAt(0) === TOKEN_COMMENT || !line.length)
            continue; // ignore comments and empty lines

        // first position is for directive call; the rest are arguments
        const [call, ...args] = line.split(/\t+/).map(a => a.trim());

        layout[i] = {
            lineNr: i + 1,   // 23
            line,            // insert ^ some-text-^-here
            call,            // insert   
            args,            // (1) '^' (2) 'some-text-^-here'
        };

        // make sure the directive is supported
        if (directives[call] === undefined)
            layout[i] = {
                ...layout[i],
                problem: new Error(`unsupported directive "${call}"`)
            };

        // check if the arguments exist, all directives have arguments
        if (args.length === 0)
            layout[i] = {
                ...layout[i],
                problem: new Error("no arguments or incorrect delimiter")
            };
    }

    return layout;
}

function utf8encode() {
    return [...new TextEncoder().encode(this), OPCODE_NULL];
}

/**
 * Compile layout/script from text to bytecode
 * 
 * @param {string} script
 * @returns {Uint8Array}
 */
export function Compile(script) {
    const buffer = []; // uint8s
    const layout = Parse(script);

    for (const thiz of layout) {
        if (thiz === null)
            continue;
        if (thiz.problem)
            throw thiz;
        // otherwise the layout is compatible
        buffer.push(
            directives[thiz.call],
            ...thiz.args.reduce((p, a) => [...p, ...utf8encode.call(a)], []),
            OPCODE_NULL);
    }

    if (buffer.at(0) !== OPCODE_LAYOUT)
        throw new Error("layout directive not set or not on first line");

    return new Uint8Array(buffer);
}

// *****************************************************************************

function resolve(args, inputArgs = []) {
    for (let i = 0, j = 0; i < args.length; i++) {
        if (args[i] !== OPCODE_NULL) continue;
        const slice = args.subarray(j, i);
        inputArgs.push(new TextDecoder().decode(slice));
        j = i + 1;
    }

    return inputArgs;
}

function load(start, program) {
    const directive = this[start];
    for (let i = start; i < this.length; i++) {
        if (this[i] === OPCODE_NULL && this[i + 1] === OPCODE_NULL) {
            const args = this.subarray(start + 1, i + 1);
            program.push([directive, resolve(args)]);
            return load.call(this, i + 2, program);
        }
    }

    const args = this.subarray(start + 1);
    if (args.length > 0)
        program.push([directive, resolve(args)]);

    return program;
}

const engine = Uint8Array.from([0x08, 0x76, 0x69, 0x76, 0x69, 0x64]); // vivid

/**
 * Read compiled layout/script and transform into a sequence of instructions
 * 
 * @param {Buffer} layoutScript
 * @returns {Array<[integer, Array<string>]>}
 */
export function Read(layoutScript) {
    const signature = layoutScript.subarray(0, engine.length);
    for (let i = 0; i < signature.length; i++)
        if (signature[i] !== engine[i])
            throw new Error("vivid does not support this layout/script");

    const offset = engine.length + 1;
    const version = layoutScript.subarray(offset, offset + 3).toString();
    if (Number(version) > 1.0)
        throw new Error(`vivid does not support this version ${version}`);

    return load.call(layoutScript, offset + 5, []); // TODO: calc offset
}

const $ = memory => [...memory[memory.length - 1] || []];

const repository = {}; // storage

function label(name) {
    if (repository[name] === undefined)
        repository[name] = [];

    repository[name].push(...$(this));

    return this; // stack not changed
}

const platform = {}; // externalize prompt directive

/**
 * Config the prompt directive to use platform features
 * 
 * @param {Map<string, Function>} prompt 
 */
export function Config(prompt) {
    Object.assign(platform, prompt);
}

function prompt(cmd, ...args) {
    if (platform[cmd])
        platform[cmd].call($(this), ...args);

    return this;
}

const KWD_SPACE = `<space>`;

function replace(expr, text) {
    return [
        ...this,
        $(this).map(a =>
            a.replace(new RegExp(expr, 'g'), text === KWD_SPACE ? ` ` : text))
    ];
}

function extract(expr) {
    return [
        ...this,
        $(this)
            .map(a => new RegExp(expr, 'g').exec(a) || [])
            .map(a => a[1] || '')
    ];
}

function remove(text) {
    return [
        ...this,
        $(this).map(a => a.replace(text, ''))
    ];
}

function insert(placeholder, text) {
    return [
        ...this,
        $(this).map(a => text?.replace(placeholder, a))
    ];
}

function glue(prefix) {
    return [
        ...this,
        $(this).map(a => prefix + a)
    ];
}

function drop(expr) {
    return [
        ...this,
        $(this).filter(a => new RegExp(expr, 'g').test(a) !== true)
    ];
}

function keep(expr) {
    return [
        ...this,
        $(this).filter(a => new RegExp(expr, 'g').test(a) === true)
    ];
}

const context = {
    document: null,
    cssValue: () => "not supported",

    bundle: null,    // or NodeList is set
    visitedNodes: [] // used by style directive for CSS
};

/**
 * Setup the dependencies of the interpreter
 * 
 * @param {object} deps 
 */
export function Setup({ document, cssValue }) {
    context.document = document;
    context.cssValue = cssValue;
}

function style(prop) {
    return [
        ...this,
        context.visitedNodes.map(a => context.cssValue.call(a, prop))
    ];
}

function _fromXPathResult(xpr) {
    switch (xpr.resultType) {
        case 1: // XPathResult.NUMBER_TYPE:
            return [xpr.numberValue.toString()];
        case 2: // XPathResult.STRING_TYPE:
            return [xpr.stringValue];
        case 3: // XPathResult.BOOLEAN_TYPE:
            return [xpr.booleanValue.toString()];
        case 8: // XPathResult.ANY_UNORDERED_NODE_TYPE:
        case 9: // XPathResult.FIRST_ORDERED_NODE_TYPE:
            return [xpr.singleNodeValue?.textContent || ""];
    }

    const values = []; // 4, 5, 6, 7 (and 0) return node-set
    let last = xpr.iterateNext();
    if (last) {
        values.push(last.textContent || "");
        context.visitedNodes.push(last);
    }

    while (last = xpr.iterateNext()) {
        values.push(last.textContent || "");
        context.visitedNodes.push(last);
    }

    return values;
}

function _followScoped(xpath) {
    const { document } = context;

    const results = [];
    for (const item of context.bundle) {
        const element = document.evaluate(xpath, item, null, 9, null); // FIRST_ORDERED_NODE_TYPE 
        results.push(element.singleNodeValue?.textContent || "");
        context.visitedNodes.push(element.singleNodeValue);
    }

    return [...this, results];
}

function _follow(xpath) {
    const { document } = context;
    const xpr = document.evaluate(xpath, document.body, null, 0, null);

    return [...this, _fromXPathResult(xpr)];
}

function follow(xpath) {
    context.visitedNodes = [];

    return context.bundle === null
        ? _follow.call(this, xpath)
        : _followScoped.call(this, xpath);
}

function _selectScoped(cssSelector) {
    const results = [];
    for (const item of context.bundle) {
        const element = item.querySelector(cssSelector);
        results.push(element?.textContent || "");
        context.visitedNodes.push(item);
    }

    return [...this, results];
}

function _select(cssSelector) {
    const elements = context.document.querySelectorAll(cssSelector);

    const results = [];
    for (let i = 0; i < elements.length; i++) {
        const item = elements.item(i);
        results.push(item.textContent);
        context.visitedNodes.push(item);
    }

    return [...this, results];
}

function select(cssSelector) {
    context.visitedNodes = [];

    return context.bundle === null
        ? _select.call(this, cssSelector)
        : _selectScoped.call(this, cssSelector);
}

function _bundle(xpath) {
    const { document } = context;
    const root = document.evaluate(xpath, document.body, null, 5, null);
    context.bundle = []; // reset

    let last = root.iterateNext();
    if (last) context.bundle.push(last);
    while (last = root.iterateNext()) context.bundle.push(last);
    context.visitedNodes = [...context.bundle];

    return this; // stack not changed
}

const KWD_NO_BUNDLE = `*`;

function bundle(xpath) {
    if (xpath !== KWD_NO_BUNDLE)
        return _bundle.call(this, xpath);

    context.bundle = null; // undo bundle

    return this;
}

function layout() {
    throw new Error("directive can be used only on first line as layout vivid");
}

const opCode = Object.freeze({
    [OPCODE_LAYOUT]: layout,
    [OPCODE_PROMPT]: prompt,
    [OPCODE_LABEL]: label,
    [OPCODE_HTML_FOLLOW]: follow,
    [OPCODE_HTML_SELECT]: select,
    [OPCODE_HTML_BUNDLE]: bundle,
    [OPCODE_TEXT_EXTRACT]: extract,
    [OPCODE_TEXT_REPLACE]: replace,
    [OPCODE_TEXT_REMOVE]: remove,
    [OPCODE_TEXT_INSERT]: insert,
    [OPCODE_TEXT_GLUE]: glue,
    [OPCODE_TEXT_DROP]: drop,
    [OPCODE_TEXT_KEEP]: keep,
    [OPCODE_CSS_STYLE]: style,
});

/**
 * Interpret step-by-step all instructions in the given program
 * 
 * @param {Array<[integer, Array<string>]} script 
 */
export function* Interpret(program) {
    for (let i = 0, memory = []; i < program.length; i++) {
        const [code, inputsArgs] = program[i];
        memory = opCode[code].call(memory, ...inputsArgs);
        yield memory;
    }
}

export const builtin = Object.values(opCode);

export default repository;

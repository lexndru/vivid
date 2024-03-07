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

import repository, * as vivid from "./vivid.js";

import { start } from "repl";
import { JSDOM } from "jsdom";
import { basename, resolve } from "path";
import { readFileSync, writeFileSync, mkdirSync } from "fs";

const shell = start("vivid # ");

const workspace = {
    step: 0,
    stack: [],
    script: null,  // null if in-memory or not set OR string if compiled 
    layout: [],
    program: null, // array for compiled OR object for in-memory
    interpreter: null,
};

const context = {
    htmlContent: null,
    htmlFile: null,
    window: null,
    history: [],
    current: [], // current directive output
    temporary: [],
};

function filepath(file) {
    file = file.toString();

    return file.startsWith("/")
        ? file
        : resolve(process.cwd(), file);
}

function fail(reason) {
    return { status: "fail", reason };
}

function okay(message) {
    return { status: "okay", message };
}

function lookahead(structure, maxLen = 0) {
    for (const line of structure) {
        if (line === null) continue;
        // directives have at least one argument
        const [firstArg] = line.args;
        if (firstArg.length > maxLen)
            maxLen = firstArg.length;
    }

    return maxLen;
}

function inspect(content, error) {
    const structure = vivid.Parse(content);
    const separator = ' |';
    console.log("START");
    const width = lookahead(structure);

    workspace.layout = structure.filter(a => a);
    workspace.layout.forEach(({ lineNr, call, args }) => {
        const [first, second] = args;

        console.log(
            lineNr.toString().padStart(4, ' ') + separator,
            call.padEnd(10, ' ') + separator,
            (first || '').padEnd(width, ' ') + separator,
            second);

        if (error?.lineNr === lineNr)
            console.log('     |\n', `    ↳`, error.problem.message, '\n');
    });

    console.log("END");
}

function Compile(file) {
    const content = readFileSync(filepath(file), { encoding: "utf8" });

    try {
        const binary = Buffer.from(vivid.Compile(content));
        workspace.program = vivid.Read(binary);
        workspace.script = content;
        inspect(content);

        shell.setPrompt("vivid [" + file.toString() + "] # ");
    } catch (error) {
        return inspect(content, error) || fail(error);
    }

    return void Reload() || okay("compiled");
}

function Layout(name) {
    workspace.interpreter = null;
    workspace.program = { _layout: name.toString() };
    workspace.script = null;
    workspace.step = 1;

    shell.setPrompt("vivid {" + name.toString() + "} # ");

    return okay("new layout");
}

function Close() {
    workspace.interpreter = null;
    workspace.program = null;
    workspace.layout = [];
    workspace.script = null;
    workspace.stack = [];
    workspace.step = 0;
    // reset repository when done work with the current layout
    Object.keys(repository).forEach(a => delete repository[a]);
    shell.setPrompt("vivid # ");

    return okay("closed layout");
}

function Reload() {
    if (workspace.script === null)
        return fail("no layout compiled");

    workspace.interpreter = vivid.Interpret(workspace.program);
    workspace.step = 0;

    return okay('reloaded');
}

function Stack() {
    return okay(workspace.stack);
}

function Stash() {
    return okay(repository);
}

function Read(file) {
    const content = readFileSync(filepath(file), { encoding: "utf8" });

    const { window } = new JSDOM(content, { resources: "usable" });
    // https://developer.mozilla.org/en-US/docs/Web/API/Node/nodeType
    const cssValue = function (prop) {
        if (this.nodeType === window.Node.ELEMENT_NODE) {
            const value = window.getComputedStyle(this).getPropertyValue(prop);

            return JSON.stringify(value);
        }

        return "not an element";
    }

    vivid.Setup({ document: window.document, cssValue });

    context.htmlContent = content.split(/\n/);
    context.htmlFile = file;
    context.window = window;

    return okay(`html read ${content.length / 1024} kilobytes`);
}

function View(lookup) {
    if (context.htmlContent === null)
        return fail("no html read yet");

    if (lookup === undefined)
        return okay(context.htmlContent);

    const output = typeof lookup === "number"
        ? context.htmlContent.slice(lookup - 5, lookup + 5)
        : context.htmlContent.filter(a => a.indexOf(lookup) > -1);

    return okay(output);
}

function Step() {
    if (workspace.interpreter === null)
        return fail("no layout compiled");

    const { value, done } = workspace.interpreter.next();

    if (done) return okay({ done }); // also prevent from erasing stack

    workspace.stack = value;
    const { line } = workspace.layout[++workspace.step];
    const output = value[value.length - 1] || [];

    return okay([line.replace(/\t/, ' '), output]);
}

function Run() {
    if (workspace.interpreter === null)
        return fail("no layout compiled");

    while (workspace.interpreter.next().done !== true) void 0;

    return okay(repository);
}

function compose() {
    return ['layout\tvivid 1.0', ...context.history].join('\n');
}

function Print() {
    void ["START", compose(), "END"].forEach(a => console.log(a));

    return okay();
}

function Save() {
    const layout = workspace.program?._layout;

    if (layout === undefined)
        return fail("there's no in-memory layout() created");

    const dir = basename(context.htmlFile);
    const location = dir + "/" + layout + ".ls";

    mkdirSync(dir, { mode: 0o700 });
    writeFileSync(location, compose());

    return okay({ location });
}

function Commit() {
    const [memory, directive, argumentz] = context.current;
    context.history.push([directive, ...argumentz].join('\t'));

    const last = memory.pop();
    if (last) context.temporary.push(last);

    return okay({ last });
}

function Help() {
    console.log(`
    compile(file) ...... compile existing layout/script from disk
    reload() ........... reset memory and reload compiled program 
    close() ............ reset memory and close layout, without saving
    read(file) ......... read html source code from disk and setup DOM
    view(lookup) ....... return lines that contain lookup text or index
    stack() ............ return the current memory stack of the program
    stash() ............ return the collection textual data with their labels
    step() ............. run program instructions step-by-step until it's EOF
    run() .............. run program in one go

  * prompt(command) .... invoke the prompt to run subcommand, if engine supports
  * label(string) ...... copy the precedent textual data under given labeled-set
  * follow(xpath) ...... perform an XPath query (it casts to text by default)
  * select(css) ........ perform CSS selector query
  * bundle(xpath) ...... create list of elements in-memory for further use
  * extract(expr) ...... evaluate a regular expression and get the first match
  * replace(expr, text)  replace content A with content B in content X
  * remove(text) ....... remove text from content; same as replace with nothing
  * insert(char, text) . insert in content a text for the char palceholder   
  * glue(prefix) ....... insert prefix at the beginning of the content
  * keep(expr) ......... filter by a regular expression if content is kept
  * drop(expr) ......... filter by a regular expression if content is dropped
  * style(property) .... get the CSS property value
  * layout(name) ....... create a new in-memory layout/script that can be
                         used as a playground for directives and saved on disk
    
    commit() ........... commit your previous directive to a history buffer
    print() ............ render the entire history buffer to inspect how the 
                         layout/script would look if written as text
    save() ............. write the history buffer on disk; it creates a new
                         folder named after the HTML file

    help() ............. show this message
    `);
}

function guard(...args) {
    if (context.window === null)
        return fail("must read() before using this function");

    context.current = [this.call(context.temporary, ...args), this.name, args];

    return context.current;
}

Object.assign(
    shell.context,
    vivid.builtin.reduce((pv, a) => ({ ...pv, [a.name]: guard.bind(a) }), {}),
);

shell.context.compile = Compile;
shell.context.layout = Layout; // override default directive behaviour
shell.context.reload = Reload;
shell.context.commit = Commit;
shell.context.print = Print;
shell.context.close = Close;
shell.context.stash = Stash;
shell.context.stack = Stack;
shell.context.read = Read;
shell.context.view = View;
shell.context.step = Step;
shell.context.help = Help;
shell.context.save = Save;
shell.context.run = Run;

function debug(message) {
    console.log(`debug "${message}"`, this);
}

vivid.Config({ debug });

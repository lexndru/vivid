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
import assert from "assert";
import jsdom from "jsdom";

const layoutScript = `
layout	vivid 1.0
# commented line
follow	xpath
select	css.selector
bundle	xpath
label	human readable text
extract	regex
replace	old	new
insert	placeholder	text with placeholder
glue	prefix
style	css property
keep	regex
drop	regex
prompt	command
`;

const bytecode = [
    8, // layout
    118, 105, 118, 105, 100, 32, 49, 46, 48, 0, // vivid 1.0
    0,

    49, // follow
    120, 112, 97, 116, 104, 0, // xpath
    0,

    50, // select
    99, 115, 115, 46, 115, 101, 108, 101, 99, 116, 111, 114, 0, // css.selector
    0,

    51, // bundle
    120, 112, 97, 116, 104, 0, // xpath
    0,

    172, // label
    104, 117, 109, 97, 110, 32, 114, 101, 97, 100, 97, 98, 108, 101, 32, 116, 101, 120, 116, 0, // human readable text
    0,

    81, // extract
    114, 101, 103, 101, 120, 0, // regex
    0,

    82, // replace
    111, 108, 100, 0, // old 
    110, 101, 119, 0, // new
    0,

    84, // insert
    112, 108, 97, 99, 101, 104, 111, 108, 100, 101, 114, 0, // placeholder
    116, 101, 120, 116, 32, 119, 105, 116, 104, 32, 112, 108, 97, 99, 101, 104, 111, 108, 100, 101, 114, 0, // text with placeholder
    0,

    85, // glue
    112, 114, 101, 102, 105, 120, 0, // prefix
    0,

    145, // style
    99, 115, 115, 32, 112, 114, 111, 112, 101, 114, 116, 121, 0, // css property
    0,

    87, // keep
    114, 101, 103, 101, 120, 0, // regex
    0,

    86, // drop
    114, 101, 103, 101, 120, 0, // regex
    0,

    221, // prompt
    99, 111, 109, 109, 97, 110, 100, 0, // command
    0
];

describe("test compiler", () => {
    it("should parse a layout/script from text to intermediate representation", () => {
        const ir = vivid.Parse(layoutScript);

        assert.strictEqual(ir.shift(), null); // it's an empty line

        assert.deepStrictEqual(ir.shift(), {
            lineNr: 2,
            line: "layout\tvivid 1.0",
            call: "layout",
            args: [
                "vivid 1.0"
            ]
        });

        assert.strictEqual(ir.shift(), null); // it's a comment

        assert.deepStrictEqual(ir.shift(), {
            lineNr: 4,
            line: "follow\txpath",
            call: "follow",
            args: [
                "xpath"
            ]
        });

        assert.deepStrictEqual(ir.shift(), {
            "lineNr": 5,
            "line": "select\tcss.selector",
            "call": "select",
            "args": [
                "css.selector"
            ]
        });

        assert.deepStrictEqual(ir.shift(), {
            "lineNr": 6,
            "line": "bundle\txpath",
            "call": "bundle",
            "args": [
                "xpath"
            ]
        });

        assert.deepStrictEqual(ir.shift(), {
            "lineNr": 7,
            "line": "label\thuman readable text",
            "call": "label",
            "args": [
                "human readable text"
            ]
        });

        assert.deepStrictEqual(ir.shift(), {
            "lineNr": 8,
            "line": "extract\tregex",
            "call": "extract",
            "args": [
                "regex"
            ]
        });

        assert.deepStrictEqual(ir.shift(), {
            "lineNr": 9,
            "line": "replace\told\tnew",
            "call": "replace",
            "args": [
                "old",
                "new"
            ]
        });

        assert.deepStrictEqual(ir.shift(), {
            "lineNr": 10,
            "line": "insert\tplaceholder\ttext with placeholder",
            "call": "insert",
            "args": [
                "placeholder",
                "text with placeholder"
            ]
        });

        assert.deepStrictEqual(ir.shift(), {
            "lineNr": 11,
            "line": "glue\tprefix",
            "call": "glue",
            "args": [
                "prefix"
            ]
        });

        assert.deepStrictEqual(ir.shift(), {
            "lineNr": 12,
            "line": "style\tcss property",
            "call": "style",
            "args": [
                "css property"
            ]
        });

        assert.deepStrictEqual(ir.shift(), {
            "lineNr": 13,
            "line": "keep\tregex",
            "call": "keep",
            "args": [
                "regex"
            ]
        });

        assert.deepStrictEqual(ir.shift(), {
            "lineNr": 14,
            "line": "drop\tregex",
            "call": "drop",
            "args": [
                "regex"
            ]
        });

        assert.deepStrictEqual(ir.shift(), {
            "lineNr": 15,
            "line": "prompt\tcommand",
            "call": "prompt",
            "args": [
                "command"
            ]
        });

        assert.strictEqual(ir.shift(), null); // new line at the end
        assert.strictEqual(ir.length, 0);
    });

    it("should compile intermediate representation to bytecode", () => {
        const bc = vivid.Compile(layoutScript);

        if (!(bc instanceof Uint8Array))
            assert.fail("unexpected compiled result");

        assert.deepStrictEqual(bc, Uint8Array.from(bytecode));
    });

    it("should fail to compile if layout directive is missing on first line", () => {
        assert.throws(
            () => vivid.Compile(`prompt\txdg-open`),
            new Error("layout directive not set or not on first line")
        );
    });

    it("should fail to compile if unsupported directive is encountered", () => {
        assert.throws(
            () => vivid.Compile(`xdg-open\t.`),
            {
                "args": [
                    "."
                ],
                "call": "xdg-open",
                "line": "xdg-open\t.",
                "lineNr": 1,
                "problem": new Error(`unsupported directive "xdg-open"`)
            }
        );
    });
});

describe("test interpreter", () => {
    const ls = Uint8Array.from(bytecode);

    it("should read bytecode and create iterable list of instructions", () => {
        const program = vivid.Read(ls);

        assert.deepStrictEqual(program.shift(), [vivid.OPCODE_HTML_FOLLOW, ["xpath"]]);
        assert.deepStrictEqual(program.shift(), [vivid.OPCODE_HTML_SELECT, ["css.selector"]]);
        assert.deepStrictEqual(program.shift(), [vivid.OPCODE_HTML_BUNDLE, ["xpath"]]);
        assert.deepStrictEqual(program.shift(), [vivid.OPCODE_LABEL, ["human readable text"]]);
        assert.deepStrictEqual(program.shift(), [vivid.OPCODE_TEXT_EXTRACT, ["regex"]]);
        assert.deepStrictEqual(program.shift(), [vivid.OPCODE_TEXT_REPLACE, ["old", "new"]]);
        assert.deepStrictEqual(program.shift(), [vivid.OPCODE_TEXT_INSERT, ["placeholder", "text with placeholder"]]);
        assert.deepStrictEqual(program.shift(), [vivid.OPCODE_TEXT_GLUE, ["prefix"]]);
        assert.deepStrictEqual(program.shift(), [vivid.OPCODE_CSS_STYLE, ["css property"]]);
        assert.deepStrictEqual(program.shift(), [vivid.OPCODE_TEXT_KEEP, ["regex"]]);
        assert.deepStrictEqual(program.shift(), [vivid.OPCODE_TEXT_DROP, ["regex"]]);
        assert.deepStrictEqual(program.shift(), [vivid.OPCODE_PROMPT, ["command"]]);

        assert.strictEqual(program.length, 0);
    });

    it("should have all directives from version 1.0 implemented", () => {
        if (vivid.builtin.length !== 14)
            assert.fail("expected all 14 directives to be implemented");

        const directives = vivid.builtin.reduce((acc, fn) => Object.assign(acc, { [fn.name]: fn.bind([]) }), {});

        assert.throws(directives.layout, new Error('directive can be used only on first line as layout vivid'));
    });

    it("should interpret the program line by line without errors", () => {
        const { window } = new jsdom.JSDOM(`mockup`);
        vivid.Setup({ document: window.document });

        const program = vivid.Read(ls);
        const interpreter = vivid.Interpret(program);

        let steps = 0;
        while (interpreter.next().done !== true) steps++;

        assert.strictEqual(steps, program.length);
        window.close();

        Object.keys(repository).forEach(a => delete repository[a]);
    });
});

const html = `
<html>
<head>
    <style type="text/css">
        h1 { color: green; }
    </style>
</head>
<body>
    <h1>this is a title</h1>
    <ul>
        <li>this is an item in a list (1)</li>
        <li>this is an item in a list (2)</li>
        <li>this is an item in a list (3)</li>
    </ul>
    <table>
        <tr>
            <td>
                <a href="#external-link">link 1</a>
            </td>
        </tr>
    </table>
    <article>
        <img src="#image-1" />
        <h2>subtitle 1</h2>
        <a href="#subtitle-link-1">link 2.1</a>
    </article>
    <article>
        <h2>subtitle 2</h2>
        <a href="#subtitle-link-2">link 2.2</a>
    </article>
    <article>
        <img src="#image-3" />
        <h2>subtitle 3</h2>
    </article>
</body>
</html>`;

describe("test html/css directives", () => {
    it("should find specified elements and output their contents", () => {
        vivid.Setup({ document: new jsdom.JSDOM(html).window.document });

        const directives = vivid.builtin.reduce((acc, fn) => Object.assign(acc, { [fn.name]: fn.bind([]) }), {});

        // undo bundle from previous test
        directives.bundle("*");

        assert.deepStrictEqual(directives.follow('//h1'), [['this is a title']]);
        assert.deepStrictEqual(directives.follow('//li'), [['this is an item in a list (1)', 'this is an item in a list (2)', 'this is an item in a list (3)']]);
        assert.deepStrictEqual(directives.follow('//a'), [['link 1', 'link 2.1', 'link 2.2']]);
        assert.deepStrictEqual(directives.follow('//table//a'), [['link 1']]);
        assert.deepStrictEqual(directives.follow('//table//a/@href'), [['#external-link']]);

        assert.deepStrictEqual(directives.select('h1'), [['this is a title']]);
        assert.deepStrictEqual(directives.select('li'), [['this is an item in a list (1)', 'this is an item in a list (2)', 'this is an item in a list (3)']]);
        assert.deepStrictEqual(directives.select('a'), [['link 1', 'link 2.1', 'link 2.2']]);
        assert.deepStrictEqual(directives.select('table a'), [['link 1']]);

        assert.deepStrictEqual(directives.follow('//article/h2'), [['subtitle 1', 'subtitle 2', 'subtitle 3']]);
        assert.deepStrictEqual(directives.follow('//article/img/@src'), [['#image-1', '#image-3']]);
        assert.deepStrictEqual(directives.follow('//article/a/@href'), [["#subtitle-link-1", "#subtitle-link-2"]]);

        directives.bundle("//article");

        assert.deepStrictEqual(directives.follow('h2'), [['subtitle 1', 'subtitle 2', 'subtitle 3']]);
        assert.deepStrictEqual(directives.follow('img/@src'), [['#image-1', '', '#image-3']]);
        assert.deepStrictEqual(directives.follow('a/@href'), [["#subtitle-link-1", "#subtitle-link-2", ""]]);

        directives.bundle("*");
    });

    it("should extract CSS properties", () => {
        const stack = [];
        const directives = vivid.builtin.reduce((acc, fn) => Object.assign(acc, { [fn.name]: fn.bind(stack) }), {});
        const { window } = new jsdom.JSDOM(html, { resources: "usable" });

        vivid.Setup({
            document: window.document,
            cssValue: function (prop) {
                return window.getComputedStyle(this).getPropertyValue(prop);
            }
        });

        directives.select("h1");

        assert.deepStrictEqual(directives.style("color"), [["rgb(0, 128, 0)"]]); // green
    });
});

describe("test text processing directives", () => {
    vivid.Setup({ document: new jsdom.JSDOM(html).window.document });

    const stack = [["#image-1", "#video-2", "#image-3"]];
    const directives = vivid.builtin.reduce((acc, fn) => Object.assign(acc, { [fn.name]: fn.bind(stack) }), {});

    it("should extract parts of text", () => {
        assert.deepStrictEqual(directives.extract("#image-([0-9])"), [...stack, ["1", "", "3"]]);
        assert.deepStrictEqual(directives.extract("#.+\-([0-9])"), [...stack, ["1", "2", "3"]]);
    });

    it("should replace regex on text with new text", () => {
        assert.deepStrictEqual(directives.replace("#[^-]+", "nr"), [...stack, ["nr-1", "nr-2", "nr-3"]]);
        assert.deepStrictEqual(directives.replace("#image", "#video"), [...stack, ["#video-1", "#video-2", "#video-3"]]);
        assert.deepStrictEqual(directives.replace("[#-]", "<space>"), [...stack, [" image 1", " video 2", " image 3"]]);
    });

    it("should remove/delete a text", () => {
        assert.deepStrictEqual(directives.remove("#"), [...stack, ["image-1", "video-2", "image-3"]]);
    });

    it("should insert the text as placeholder in another text", () => {
        assert.deepStrictEqual(directives.insert("?", "before ? & after"), [...stack, ["before #image-1 & after", "before #video-2 & after", "before #image-3 & after"]]);
    });

    it("should add a prefix to the text", () => {
        assert.deepStrictEqual(directives.glue("prefix"), [...stack, ["prefix#image-1", "prefix#video-2", "prefix#image-3"]]);
    });

    it("should filter to keep/drop by regex", () => {
        assert.deepStrictEqual(directives.keep("video"), [...stack, ["#video-2"]]);
        assert.deepStrictEqual(directives.keep("image"), [...stack, ["#image-1", "#image-3"]]);

        assert.deepStrictEqual(directives.drop("image"), [...stack, ["#video-2"]]);
        assert.deepStrictEqual(directives.drop("video"), [...stack, ["#image-1", "#image-3"]]);
    });
});

describe("test generic side-effect directives", () => {
    vivid.Setup({ document: new jsdom.JSDOM(html).window.document });

    const stack = [];
    const directives = vivid.builtin.reduce((acc, fn) => Object.assign(acc, { [fn.name]: fn.bind(stack) }), {});

    it("should populate the repository with classified content", () => {
        assert.deepStrictEqual(repository, {});

        stack.push(...directives.select("li"));
        directives.label("items");

        assert.deepStrictEqual(repository, { "items": ["this is an item in a list (1)", "this is an item in a list (2)", "this is an item in a list (3)"] });
    });

    it("should delegate to an external prompt", () => {
        const to = setTimeout(() => assert.fail("prompt was not called"), 100);

        vivid.Config({ halt: () => clearTimeout(to) });

        directives.prompt("halt");
    });
});

describe("test sample layout/script", () => {
    vivid.Setup({ document: new jsdom.JSDOM(html).window.document });

    const bin = vivid.Compile(`
        layout	vivid 1.0
        # get all hrefs from links
        follow	//a/@href
        remove	#
        label	links
        # get all subtitles
        select	h2
        replace	subtitle\\s	h2-
        label	subtitles
        # find all images
        follow	//img/@src
        insert	~	<video data-src="~" />
        label	image tags`);

    const ls = vivid.Read(bin);

    it("should run a layout/script and populate the repository", () => {
        assert.strictEqual(repository["links"], undefined);
        assert.strictEqual(repository["subtitles"], undefined);
        assert.strictEqual(repository["image tags"], undefined);

        const interpreter = vivid.Interpret(ls);
        while (interpreter.next().done !== true) void 0;

        assert.deepStrictEqual(repository["links"], ['external-link', 'subtitle-link-1', 'subtitle-link-2']);
        assert.deepStrictEqual(repository["subtitles"], ['h2-1', 'h2-2', 'h2-3']);
        assert.deepStrictEqual(repository["image tags"], ['<video data-src="#image-1" />', '<video data-src="#image-3" />']);
    });
});
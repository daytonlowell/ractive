/* global document */
import { initModule, hasUsableConsole, onWarn } from '../helpers/test-config';
import { fire } from 'simulant';
import { test } from 'qunit';

export default function() {
  initModule('partials.js');

  const partialsFn = {
    foo() {
      return this.get('foo') ? '<p>yes</p>' : '<h1>no</h1>';
    }
  };

  test('specify partial by function', t => {
    new Ractive({
      el: fixture,
      template: '{{>foo}}',
      data: { foo: true },
      partials: partialsFn
    });

    t.htmlEqual(fixture.innerHTML, '<p>yes</p>');
  });

  if (hasUsableConsole) {
    test('no return of partial warns in debug', t => {
      t.expect(2);

      onWarn(msg => {
        t.ok(msg);
      });

      // will throw on no-partial found
      new Ractive({
        el: fixture,
        template: '{{>foo}}',
        data: { foo: true },
        debug: true,
        partials: {
          foo() {
            // where's my partial?
          }
        }
      });
    });

    test('Warn on unknown partial', t => {
      t.expect(2);

      onWarn(() => t.ok(true));

      new Ractive({
        el: fixture,
        template: '{{>unknown}}{{>other {a:42} }}',
        partials: {}
      });
    });

    test("Don't warn on empty partial", t => {
      t.expect(1);

      onWarn(() => {
        t.ok(false);
      });

      new Ractive({
        el: fixture,
        template: '{{>empty}}',
        partials: {
          empty: ''
        }
      });

      t.ok(true);
    });

    test('dynamic partial that fails to resolve warns in debug', t => {
      t.expect(1);

      onWarn(msg => {
        t.ok(msg);
      });

      const r = new Ractive({
        el: fixture,
        template: '{{>bar}}',
        data: { bar: 'foo' },
        debug: true,
        partials: {
          foo: 'hello'
        }
      });

      r.set('bar', 'nope');
    });

    test(`dynamic inline partial that fails to parse warns in debug`, t => {
      t.expect(1);

      onWarn(msg => {
        t.ok(/not parse partial from expression/.test(msg));
      });

      new Ractive({
        target: fixture,
        template: '{{>foo}}',
        data: {
          foo: { template: '{{#lol, nope}}' }
        }
      });
    });
  }

  test('`this` in function refers to ractive instance', t => {
    let thisForFoo;
    let thisForBar;

    const ractive = new Ractive({
      el: fixture,
      template: '{{>foo}}<widget/>',
      data: { foo: true },
      components: {
        widget: Ractive.extend({
          template: '{{>bar}}',
          isolated: false
        })
      },
      partials: {
        foo() {
          thisForFoo = this;
          return 'foo';
        },
        bar() {
          thisForBar = this;
          return 'bar';
        }
      }
    });

    t.equal(thisForFoo, ractive);
    t.equal(thisForBar, ractive);
  });

  test('partial function has access to parser helper', t => {
    t.expect(1);

    new Ractive({
      el: fixture,
      template: '{{>foo}}',
      partials: {
        foo(parser) {
          t.ok(parser.fromId);
          return 'x';
        }
      }
    });
  });

  test('partial can be preparsed template (#942)', t => {
    const partial = Ractive.parse('<p>hello partial</p>');

    new Ractive({
      el: fixture,
      template: '{{>foo}}',
      partials: { foo: partial }
    });

    t.htmlEqual(fixture.innerHTML, '<p>hello partial</p>');
  });

  test('partial functions belong to instance, not Component', t => {
    const Component = Ractive.extend({
      template: '{{>foo}}',
      partials: partialsFn
    });

    const ractive1 = new Component({
      data: { foo: true }
    });

    const ractive2 = new Component({
      data: { foo: false }
    });

    t.equal(ractive1.toHTML(), '<p>yes</p>');
    t.equal(ractive2.toHTML(), '<h1>no</h1>');
  });

  test('partial functions selects same partial until reset', t => {
    const ractive = new Ractive({
      el: fixture,
      template: '{{#items}}{{>foo}}{{/items}}',
      partials: {
        foo() {
          return this.get('foo') ? '<p>{{.}}</p>' : '<h1>{{.}}</h1>';
        }
      },
      data: {
        foo: true,
        items: [1]
      }
    });

    t.htmlEqual(fixture.innerHTML, '<p>1</p>');

    ractive.set('foo', false);
    ractive.push('items', 2);

    t.htmlEqual(fixture.innerHTML, '<p>1</p><p>2</p>');
  });

  test('reset data re-evaluates partial function', t => {
    const ractive = new Ractive({
      el: fixture,
      template: '{{>foo}}',
      data: { foo: true },
      partials: partialsFn
    });

    t.htmlEqual(fixture.innerHTML, '<p>yes</p>');
    ractive.reset({ foo: false });
    t.htmlEqual(fixture.innerHTML, '<h1>no</h1>');
  });

  test('partials functions can be found on view heirarchy', t => {
    const Widget = Ractive.extend({
      template: '{{>foo}}',
      isolated: false
    });

    const ractive = new Ractive({
      el: fixture,
      template: '{{#if !foo}}<Widget/>{{/if}}',
      components: { Widget },
      data: { foo: true },
      partials: partialsFn
    });

    t.htmlEqual(fixture.innerHTML, '');
    ractive.set('foo', false);
    t.htmlEqual(fixture.innerHTML, '<h1>no</h1>');
  });

  test('static partials are compiled on Component not instance', t => {
    const Component = Ractive.extend({
      template: '{{>foo}}',
      partials: {
        foo: '<p>{{foo}}</p>'
      }
    });

    const ractive = new Component({
      el: fixture
    });

    t.ok(!ractive.partials.hasOwnProperty('foo'));
    t.deepEqual(Component.partials.foo, [{ t: 7, e: 'p', f: [{ t: 2, r: 'foo' }] }]);
  });

  test('Partials work in attributes (#917)', t => {
    const ractive = new Ractive({
      el: fixture,
      template: '<div style="{{>boxAttr}}"/>',
      partials: {
        boxAttr: 'height: {{height}}px;'
      },
      data: {
        height: 100
      }
    });

    ractive.set('height', 200);

    t.htmlEqual(fixture.innerHTML, `<div style="height: 200px;"></div>`);
  });

  test('Partial name can be a reference', t => {
    const ractive = new Ractive({
      el: fixture,
      template: `{{#each items}}{{>type}}{{/each}}`,
      data: {
        items: [{ type: 'foo' }, { type: 'bar' }, { type: 'foo' }, { type: 'baz' }]
      },
      partials: {
        foo: ':FOO',
        bar: ':BAR',
        baz: ':BAZ'
      }
    });

    t.htmlEqual(fixture.innerHTML, ':FOO:BAR:FOO:BAZ');
    ractive.push('items', { type: 'foo' });
    t.htmlEqual(fixture.innerHTML, ':FOO:BAR:FOO:BAZ:FOO');
    ractive.set('items[1].type', 'baz');
    t.htmlEqual(fixture.innerHTML, ':FOO:BAZ:FOO:BAZ:FOO');
  });

  test('Partial name can be an expression', t => {
    const ractive = new Ractive({
      el: fixture,
      template: `{{>'partial_' + x}}`,
      data: { x: 'a' },
      partials: {
        partial_a: 'first',
        partial_b: 'second'
      }
    });

    t.htmlEqual(fixture.innerHTML, 'first');
    ractive.set('x', 'b');
    t.htmlEqual(fixture.innerHTML, 'second');
  });

  test('Expression partials can be nested', t => {
    const ractive = new Ractive({
      el: fixture,
      template: `{{>'NESTED'.toLowerCase()}}`,
      data: { x: 'a' },
      partials: {
        nested: `<p>{{>'child_' + x}}</p>`,
        child_a: '{{>foo}}',
        child_b: '{{>bar}}',
        foo: 'it works',
        bar: 'it still works'
      }
    });

    t.htmlEqual(fixture.innerHTML, '<p>it works</p>');
    ractive.set('x', 'b');
    t.htmlEqual(fixture.innerHTML, '<p>it still works</p>');
  });

  test('Partials with expressions may also have context', t => {
    new Ractive({
      el: fixture,
      template: '{{>(tpl + ".test") ctx}} : {{>"test." + tpl { ...ctx.expr }}}',
      data: {
        ctx: { id: 1, expr: { id: 2 } },
        tpl: 'foo'
      },
      partials: {
        'test.foo': 'normal - {{.id}}',
        'foo.test': 'inverted - {{.id}}'
      }
    });

    t.htmlEqual(fixture.innerHTML, 'inverted - 1 : normal - 2');
  });

  test('Partials with context should still have access to special refs (#2164)', t => {
    new Ractive({
      el: fixture,
      template: '{{>foo bar.baz}}',
      partials: {
        foo: `{{ @keypath + '.bop' }}`
      }
    });

    t.htmlEqual(fixture.innerHTML, 'bar.baz.bop');
  });

  test('Partials .toString() works when not the first child of parent (#1163)', t => {
    const ractive = new Ractive({
      template: '<div>Foo {{>foo}}</div>',
      partials: { foo: '...' }
    });

    t.htmlEqual(ractive.toHTML(), '<div>Foo ...</div>');
  });

  test('Dynamic partial works with shuffle set (#1313)', t => {
    let fields = [{ type: 'text', value: 'hello' }, { type: 'number', value: 123 }];

    const ractive = new Ractive({
      el: fixture,
      template: `{{#fields}}{{> .type + 'Field' }}{{/}}`,
      partials: {
        textField: 'text{{value}}',
        numberField: 'number{{value}}'
      },
      data: { fields }
    });

    t.htmlEqual(ractive.toHTML(), 'texthellonumber123');

    fields = [fields[1], fields[0]];
    ractive.set('fields', fields, { shuffle: true });

    t.htmlEqual(ractive.toHTML(), 'number123texthello');
  });

  test("Nameless expressions with no matching partial don't throw", t => {
    onWarn(msg => t.ok(/Could not find template for partial 'missing'/.test(msg)));

    const ractive = new Ractive({
      el: fixture,
      template: `{{> 'miss' + 'ing' }}`
    });

    t.htmlEqual(ractive.toHTML(), '');
  });

  test('Partials can be changed with resetPartial', t => {
    const ractive = new Ractive({
      el: fixture,
      template: `wrapped {{>'partial'}} around`,
      partials: {
        partial: 'inner'
      }
    });

    t.htmlEqual(fixture.innerHTML, 'wrapped inner around');
    ractive.resetPartial('partial', 'ninner');
    t.htmlEqual(fixture.innerHTML, 'wrapped ninner around');
  });

  test('Partials with variable names can be changed with resetPartial', t => {
    onWarn(msg => t.ok(/Could not find template for partial 'partial'/.test(msg)));

    const ractive = new Ractive({
      el: fixture,
      template: 'wrapped {{>partial}} around',
      partials: {
        foo: 'foo',
        bar: 'bar'
      }
    });

    t.htmlEqual(fixture.innerHTML, 'wrapped  around');
    ractive.set('partial', 'foo');
    t.htmlEqual(fixture.innerHTML, 'wrapped foo around');
    ractive.resetPartial('foo', 'nfoo');
    t.htmlEqual(fixture.innerHTML, 'wrapped nfoo around');
    ractive.set('partial', 'bar');
    t.htmlEqual(fixture.innerHTML, 'wrapped bar around');
    ractive.resetPartial('bar', 'nbar');
    t.htmlEqual(fixture.innerHTML, 'wrapped nbar around');
  });

  test('Partials with expression names can be changed with resetPartial', t => {
    onWarn(msg => t.ok(/Could not find template for partial 'undefinedPartial'/.test(msg)));

    const ractive = new Ractive({
      el: fixture,
      template: `wrapped {{>foo + 'Partial'}} around`,
      partials: {
        fooPartial: 'foo'
      }
    });

    t.htmlEqual(fixture.innerHTML, 'wrapped  around');
    ractive.set('foo', 'foo');
    t.htmlEqual(fixture.innerHTML, 'wrapped foo around');
    ractive.resetPartial('fooPartial', 'nfoo');
    t.htmlEqual(fixture.innerHTML, 'wrapped nfoo around');
  });

  test('Partials inside conditionals can be changed with resetPartial', t => {
    const ractive = new Ractive({
      el: fixture,
      template: `{{#cond}}{{>partial}}{{/}}`,
      partials: {
        partial: 'foo'
      }
    });

    t.htmlEqual(fixture.innerHTML, '');
    ractive.set('cond', true);
    t.htmlEqual(fixture.innerHTML, 'foo');
    ractive.resetPartial('partial', 'nfoo');
    t.htmlEqual(fixture.innerHTML, 'nfoo');
  });

  test('Partials (only) borrowed by components can be changed with resetPartial', t => {
    const ractive = new Ractive({
      el: fixture,
      template: '{{>foo}} {{>bar}} <component />',
      partials: {
        foo: 'rfoo',
        bar: 'rbar'
      },
      components: {
        component: Ractive.extend({
          template: '{{>foo}} {{>bar}}',
          partials: {
            bar: 'cbar'
          },
          isolated: false
        })
      }
    });

    t.htmlEqual(fixture.innerHTML, 'rfoo rbar rfoo cbar');
    ractive.resetPartial('foo', 'nrfoo');
    t.htmlEqual(fixture.innerHTML, 'nrfoo rbar nrfoo cbar');
    ractive.resetPartial('bar', 'nrbar');
    t.htmlEqual(fixture.innerHTML, 'nrfoo nrbar nrfoo cbar');
    ractive.findComponent('component').resetPartial('bar', 'ncbar');
    t.htmlEqual(fixture.innerHTML, 'nrfoo nrbar nrfoo ncbar');
  });

  test('Partials inside iteratives can be changed with resetPartial', t => {
    const ractive = new Ractive({
      el: fixture,
      template: '{{#list}}{{>.type}}{{/}}',
      partials: {
        t1: 't1',
        t2: 't2'
      },
      data: {
        list: [{ type: 't1' }, { type: 't2' }, { type: 't1' }]
      }
    });

    t.htmlEqual(fixture.innerHTML, 't1t2t1');
    ractive.resetPartial('t1', 'nt1');
    t.htmlEqual(fixture.innerHTML, 'nt1t2nt1');
    ractive.resetPartial('t2', 'nt2');
    ractive.resetPartial('t1', '');
    t.htmlEqual(fixture.innerHTML, 'nt2');
  });

  test('Nested partials can be changed with resetPartial', t => {
    const ractive = new Ractive({
      el: fixture,
      template: '{{>outer}}',
      partials: {
        outer: 'outer({{>inner}})',
        inner: 'inner'
      }
    });

    t.htmlEqual(fixture.innerHTML, 'outer(inner)');
    ractive.resetPartial('inner', 'ninner');
    t.htmlEqual(fixture.innerHTML, 'outer(ninner)');
    ractive.resetPartial('outer', '({{>inner}})outer');
    t.htmlEqual(fixture.innerHTML, '(ninner)outer');
    ractive.resetPartial('outer', 'outer');
    t.htmlEqual(fixture.innerHTML, 'outer');
  });

  test('Partials in context blocks can be changed with resetPartial', t => {
    const ractive = new Ractive({
      el: fixture,
      template: `{{#with { ctx: 'foo' } }}{{>ctx}}{{/with}}`,
      partials: {
        foo: 'foo'
      }
    });

    t.htmlEqual(fixture.innerHTML, 'foo');
    ractive.resetPartial('foo', 'nfoo');
    t.htmlEqual(fixture.innerHTML, 'nfoo');
  });

  test('Partials in attributes can be changed with resetPartial', t => {
    const ractive = new Ractive({
      el: fixture,
      template: '<div class="wrapped {{>foo}} around" id="{{>foo}}"></div>',
      partials: {
        foo: 'foo'
      }
    });

    t.htmlEqual(fixture.innerHTML, '<div class="wrapped foo around" id="foo"></div>');
    ractive.resetPartial('foo', 'nfoo');
    t.htmlEqual(fixture.innerHTML, '<div class="wrapped nfoo around" id="nfoo"></div>');
  });

  test('Partials in attribute blocks can be changed with resetPartial', t => {
    const ractive = new Ractive({
      el: fixture,
      template: `<div {{#cond}}class="wrapped {{>foo}} around" id="{{>foo}}" {{>attr}}{{/}}></div>`,
      partials: {
        foo: 'foo',
        attr: 'title="{{>foo}}"'
      }
    });

    t.htmlEqual(fixture.innerHTML, '<div></div>');
    ractive.set('cond', true);
    t.htmlEqual(fixture.innerHTML, '<div class="wrapped foo around" id="foo" title="foo"></div>');
    ractive.resetPartial('foo', 'nfoo');
    t.htmlEqual(
      fixture.innerHTML,
      '<div class="wrapped nfoo around" id="nfoo" title="nfoo"></div>'
    );
    ractive.resetPartial('attr', 'alt="bar"');
    t.htmlEqual(fixture.innerHTML, '<div class="wrapped nfoo around" id="nfoo" alt="bar"></div>');
  });

  test('Partial naming requirements are relaxed', t => {
    new Ractive({
      el: fixture,
      template: `{{>a-partial}}{{>10-2}}{{>a - partial}}{{>delete}}`,
      partials: {
        'a-partial': 'a',
        8: 'b',
        delete: 'c'
      },
      data: {
        a: 10,
        partial: 2
      }
    });

    t.htmlEqual(fixture.innerHTML, 'abbc');
  });

  test('Inline partials can override component partials', t => {
    new Ractive({
      el: fixture,
      template: `
				<Widget>
					{{#partial part}}
						inline
					{{/partial}}
				</Widget>
				<Widget/>
			`,
      components: {
        Widget: Ractive.extend({
          template: '{{>part}}',
          partials: { part: 'component' }
        })
      }
    });

    t.htmlEqual(fixture.innerHTML, 'inline component');
  });

  test('Inline partials may be defined with a partial section', t => {
    new Ractive({
      el: fixture,
      template: `
				{{#partial foo}}foo{{/partial}}
				{{>foo}}
				<Widget/>
				<Widget>
					{{#partial foo}}bar{{/partial}}
				</Widget>`,
      components: {
        Widget: Ractive.extend({
          template: '{{>foo}}',
          isolated: false
        })
      }
    });

    t.htmlEqual(fixture.innerHTML, 'foo foo bar');
  });

  test('inline partials take precedent over assigned instance partials for yield', t => {
    onWarn(msg => t.ok(/Could not find template for partial "foo"/.test(msg)));

    const Widget = Ractive.extend({
      template: '{{yield foo}}',
      partials: { foo: 'bar' }
    });

    new Ractive({
      el: fixture,
      template: `
				<Widget/>
				<Widget>{{#partial foo}}foo{{/partial}}</Widget>`,
      components: { Widget }
    });

    t.htmlEqual(fixture.innerHTML, 'bar foo');
  });

  test("Don't throw on empty partial", t => {
    t.expect(1);

    new Ractive({
      el: fixture,
      template: '{{>empty}}',
      debug: true,
      partials: {
        empty: ''
      }
    });

    t.ok(true);
  });

  test('Dynamic empty partial ok', t => {
    const ractive = new Ractive({
      el: fixture,
      template: '{{>foo}}',
      debug: true,
      partials: {
        empty: '',
        'not-empty': 'bar'
      },
      data: { foo: 'not-empty' }
    });

    t.htmlEqual(fixture.innerHTML, 'bar');
    ractive.set('foo', 'empty');
    t.htmlEqual(fixture.innerHTML, '');
    ractive.set('foo', 'not-empty');
    t.htmlEqual(fixture.innerHTML, 'bar');
  });

  test('Partials with expressions in recursive structures should not blow the stack', t => {
    new Ractive({
      el: fixture,
      template: "{{#items}}{{>'item'}}{{/}}",
      partials: {
        item: "{{.foo}}{{#.items}}{{>'item'}}{{/}}"
      },
      data: {
        items: [{ items: [{ foo: 'a', items: [{ foo: 'b' }] }] }]
      }
    });

    t.htmlEqual(fixture.innerHTML, 'ab');
  });

  test('Named partials should not get rebound if they happen to have the same name as a reference (#1507)', t => {
    const ractive = new Ractive({
      el: fixture,
      template: `
				{{#each items}}
					{{>item}}
				{{/each}}

				{{#if items.length > 1}}
					{{#with items[items.length-1]}}
						{{>item}}
					{{/with}}
				{{/if}}`,
      partials: {
        item: '{{item}}'
      },
      data: {
        items: []
      }
    });

    ractive.push('items', { item: 'a' });
    ractive.push('items', { item: 'b' });
    ractive.push('items', { item: 'c' });

    t.htmlEqual(fixture.innerHTML, 'abc c');
  });

  test('Partials from the template hierarchy should take precedent over references', t => {
    const ractive = new Ractive({
      el: fixture,
      template: `<p>
				{{#partial item}}{{item}}{{/partial}}
				{{#each items}}
					{{>item}}
				{{/each}}

				{{#if items.length > 1}}
					{{#with items[items.length-1]}}
						{{>item}}
					{{/with}}
				{{/if}}
			</p>`,
      data: {
        items: []
      }
    });

    ractive.push('items', { item: 'a' });
    ractive.push('items', { item: 'b' });
    ractive.push('items', { item: 'c' });

    t.htmlEqual(fixture.innerHTML, '<p> abc c</p>');
  });

  test('Partial names can have slashes', t => {
    new Ractive({
      el: fixture,
      template: '<p>{{#partial foo/bar}}foobar{{/partial}}{{> foo/bar}}</p>'
    });

    t.htmlEqual('<p>foobar</p>', fixture.innerHTML);
  });

  test('Several inline partials containing elements can be defined (#1736)', t => {
    const ractive = new Ractive({
      el: fixture,
      template: `
				{{#partial part1}}
					<div>inline1</div>
				{{/partial}}
				{{#partial part2}}
					<div>inline2</div>
				{{/partial}}

				A{{>part1}}B{{>part2}}C`
    });

    t.htmlEqual(fixture.innerHTML, 'A<div>inline1</div>B<div>inline2</div>C');
    t.equal(ractive.partials.part1.length, 1);
    t.equal(ractive.partials.part2.length, 1);
  });

  test('Removing a missing partial (#1808)', t => {
    t.expect(1);

    onWarn(msg => t.ok(/Could not find template for partial 'item'/.test(msg)));

    const ractive = new Ractive({
      template: '{{#items}}{{>item}}{{/}}',
      el: 'main',
      data: {
        items: [1, 2, 3]
      }
    });

    ractive.unshift('items', 4);
    ractive.shift('items');
  });

  test('Dynamic partial can be set in oninit (#1826)', t => {
    new Ractive({
      el: fixture,
      template: '{{> partialName }}',
      partials: {
        one: 'onepart',
        two: 'twopart'
      },
      data: {
        partialName: 'one'
      },
      oninit() {
        this.set({ partialName: 'two' });
      }
    });

    t.htmlEqual(fixture.innerHTML, 'twopart');
  });

  test("Inline partials don't dissipate into the ether when attached to non-components (#1838)", t => {
    new Ractive({
      el: fixture,
      template: '<div>{{#partial foo}}foo{{/partial}}{{>foo}}</div>'
    });

    t.htmlEqual(fixture.innerHTML, '<div>foo</div>');
  });

  test('Inline partials can override instance partials if they exist on a node directly up-hierarchy', t => {
    new Ractive({
      el: fixture,
      template: `{{#partial foo}}
					Something happens {{>here}}
				{{/partial}}

				<div>
					{{#partial here}}one{{/partial}}
					<span>{{>foo}}</span>
				</div>
				<div>
					{{#partial here}}two{{/partial}}
					<span>{{>foo}}</span>
				</div>`
    });

    t.htmlEqual(
      fixture.innerHTML,
      '<div><span>Something happens one</span></div><div><span>Something happens two</span></div>'
    );
  });

  test('partial expressions will use inline content if they resolve to an object with a template string property', t => {
    const r = new Ractive({
      el: fixture,
      template: '{{>foo}}',
      data: {
        foo: { template: 'this is a {{bar}}' },
        bar: 'test'
      }
    });

    t.htmlEqual(fixture.innerHTML, 'this is a test');
    r.set('bar', 'turnip');
    t.htmlEqual(fixture.innerHTML, 'this is a turnip');
    r.set('foo.template', '{{bar}}s are tasty');
    t.htmlEqual(fixture.innerHTML, 'turnips are tasty');
  });

  test('partial expressions will use inline content if they resolve to a pre-parsed template', t => {
    const r = new Ractive({
      el: fixture,
      template: '{{>foo}}',
      data: {
        foo: Ractive.parse('this is a {{bar}}'),
        bar: 'test'
      }
    });

    t.htmlEqual(fixture.innerHTML, 'this is a test');
    r.set('bar', 'turnip');
    t.htmlEqual(fixture.innerHTML, 'this is a turnip');
    r.set('foo', Ractive.parse('{{bar}}s are tasty'));
    t.htmlEqual(fixture.innerHTML, 'turnips are tasty');
  });

  test('resetting a dynamic partial to its reference name should replace the partial (#2185)', t => {
    onWarn(msg => t.ok(/Could not find template for partial 'nope'/.test(msg)));

    const r = new Ractive({
      el: fixture,
      template: '{{>part1}}{{>part2}}',
      partials: { part3: 'part3' },
      data: { part1: 'part3', part2: 'nope' }
    });

    t.htmlEqual(fixture.innerHTML, 'part3');

    r.resetPartial('part1', 'part1');
    t.htmlEqual(fixture.innerHTML, 'part1');

    r.resetPartial('part2', 'part2');
    t.htmlEqual(fixture.innerHTML, 'part1part2');
  });

  test(`Partials can have context that starts with '.' (#1880)`, t => {
    new Ractive({
      el: fixture,
      template: '{{#with foo}}{{>foo .bar}}{{/with}}',
      data: {
        foo: { bar: { baz: 'bat' } }
      },
      partials: {
        foo: '{{.baz}}'
      }
    });

    t.htmlEqual(fixture.innerHTML, 'bat');
  });

  test('Context computations are not called unnecessarily (#2224)', t => {
    t.expect(2);

    const ractive = new Ractive({
      el: fixture,
      template: `
				{{#if foo}}
					{{>p { x: y( foo.bar )} }}
				{{/if}}`,
      data: {
        foo: { bar: 42 },
        y(num) {
          t.equal(num, 42);
          return num;
        }
      },
      partials: {
        p: '{{x}}'
      }
    });

    t.htmlEqual(fixture.innerHTML, '42');

    ractive.set('foo', null);
  });

  test('Partials can be given alias context (#2298)', t => {
    new Ractive({
      el: fixture,
      template: '{{>foo foo.bar as bat, bip.bop as boo}}',
      data: {
        foo: { bar: 'one' },
        bip: { bop: 'two' }
      },
      partials: {
        foo: '{{bat}} {{boo}}'
      }
    });

    t.htmlEqual(fixture.innerHTML, 'one two');
  });

  test('Partials can be parsed from a partial template (#1445)', t => {
    fixture.innerHTML = '<div id="fixture-tmp"></div>';
    const script = document.createElement('script');
    script.setAttribute('type', 'text/html');
    script.setAttribute('id', 'foo');
    script['textContent' in script ? 'textContent' : 'innerHTML'] = `
			{{#partial bar}}inner{{/partial}}
			outer
		`;
    fixture.appendChild(script);

    new Ractive({
      el: '#fixture-tmp',
      template: `{{>foo}} {{>bar}}`
    });

    t.htmlEqual(fixture.childNodes[0].innerHTML, 'outer inner');
  });

  test("pre-parsed dynamic inline partial from computation doesn't try to reset on init if a binding causes an update (#2641)", t => {
    const cmp = Ractive.extend({
      template: '<input type="checkbox" checked="{{flag}}" />'
    });
    const r = new Ractive({
      el: fixture,
      template: '{{>fn()}}',
      data: {
        fn() {
          return this.get('tpl');
        },
        tpl: Ractive.parse('hullo <cmp/>')
      },
      components: { cmp }
    });

    t.htmlEqual(fixture.innerHTML, 'hullo <input type="checkbox" />');
    r.set('tpl', Ractive.parse('yup <cmp/>'));
    t.htmlEqual(fixture.innerHTML, 'yup <input type="checkbox" />');
  });

  test("unparsed dynamic inline partial from computation doesn't try to reset on init if a binding causes an update (#2641)", t => {
    const cmp = Ractive.extend({
      template: '<input type="checkbox" checked="{{flag}}" />'
    });
    const r = new Ractive({
      el: fixture,
      template: '{{>fn()}}',
      data: {
        fn() {
          return this.get('tpl');
        },
        tpl: { template: 'hullo <cmp/>' }
      },
      components: { cmp }
    });

    t.htmlEqual(fixture.innerHTML, 'hullo <input type="checkbox" />');
    r.set('tpl', { template: 'yup <cmp/>' });
    t.htmlEqual(fixture.innerHTML, 'yup <input type="checkbox" />');
  });

  test('arg for event handler from previously uninitialised partial context (#2736)', t => {
    let v;
    const r = new Ractive({
      el: fixture,
      partials: {
        foo: '<button on-click="@this.handler(id)">asd</button>'
      },
      template: '{{>foo item}}',
      data: { item: {} }
    });

    r.handler = id => {
      v = id;
    };

    r.set('item.id', 1123);

    fire(r.find('button'), 'click');

    t.equal(v, 1123);
  });

  test(`partial expressions survive rebinding`, t => {
    const r = new Ractive({
      target: fixture,
      template: `{{> foo[0].bar}}`,
      data: {
        foo: [{ bar: 'p' }]
      },
      partials: {
        p: '?',
        q: 'yep'
      }
    });

    t.htmlEqual(fixture.innerHTML, '?');

    r.unshift('foo', { bar: 'q' });
    t.htmlEqual(fixture.innerHTML, 'yep');
  });

  test('Inline partial on instance config', t => {
    const Component = Ractive.extend({ template: '' });
    const instance = Component({
      template: '{{foo}}{{#partial bar}}{{bar}}{{/partial}}'
    });

    t.deepEqual(instance.template, [{ r: 'foo', t: 2 }]);
    t.deepEqual(instance.partials.bar, [{ r: 'bar', t: 2 }]);
  });

  test('Inline partial on component config', t => {
    const Parent = Ractive.extend({ template: '' });
    const Child = Parent.extend({
      template: '{{foo}}{{#partial bar}}{{bar}}{{/partial}}'
    });
    const template = Child.prototype.template;

    t.deepEqual(template, {
      v: 4,
      t: [{ r: 'foo', t: 2 }],
      p: { bar: [{ r: 'bar', t: 2 }] }
    });
  });

  test('Inline partial does not override option partials when not in use', t => {
    const Component = Ractive.extend({ template: '' });
    const instance = Component({
      template: '{{foo}}{{#partial bar}}{{bar}}{{/partial}}',
      partials: { bar: '{{ baz }}', qux: '{{ qux }}' }
    });

    t.deepEqual(instance.template, [{ r: 'foo', t: 2 }]);
    t.deepEqual(instance.partials.bar, '{{ baz }}');
    t.deepEqual(instance.partials.qux, '{{ qux }}');
  });

  test('Inline partial overrides option partials when in use', t => {
    const Component = Ractive.extend({ template: '' });
    const instance = Component({
      template: '{{foo}}{{#partial bar}}{{bar}}{{/partial}}{{> bar}}{{> qux}}',
      partials: { bar: '{{ baz }}', qux: '{{ qux }}' }
    });

    t.deepEqual(instance.template, [{ r: 'foo', t: 2 }, { r: 'bar', t: 8 }, { r: 'qux', t: 8 }]);
    t.deepEqual(instance.partials.bar, [{ r: 'baz', t: 2 }]);
    t.deepEqual(instance.partials.qux, [{ r: 'qux', t: 2 }]);
  });

  test('Line positions are not used as inline partials (#3082)', t => {
    const Component = Ractive.extend({ template: '' });

    try {
      Component({
        template: Ractive.parse('<div>{{>sort}}</div>', {
          includeLinePositions: true
        })
      });

      t.ok(true);
    } catch (e) {
      t.ok(false);
    }
  });

  test(`yielding outside of a component context is a noop #3086`, t => {
    const child = new Ractive({
      target: fixture,
      template: '{{yield}}!'
    });

    t.htmlEqual(fixture.innerHTML, '!');

    const r = new Ractive({
      target: fixture,
      template: `<#anchor>{{name}} content</anchor>`,
      data: {
        name: 'default'
      }
    });

    t.htmlEqual(fixture.innerHTML, '');
    r.attachChild(child, { target: 'anchor' });
    t.htmlEqual(fixture.innerHTML, 'default content!');
  });

  test(`inline content partial from outside of component should not override component content`, t => {
    new Ractive({
      target: fixture,
      template: '<p>{{#partial content}}nope{{/partial}}<cmp>yep</cmp></p>',
      components: {
        cmp: Ractive.extend({ template: '{{yield}}' })
      }
    });

    t.htmlEqual(fixture.innerHTML, '<p>yep</p>');
  });

  test(`static partials are, in fact, static`, t => {
    const r = new Ractive({
      target: fixture,
      template: '[[>foo]]',
      data: {
        foo: 'bar'
      },
      partials: {
        bar: 'bar',
        baz: 'baz'
      }
    });

    t.htmlEqual(fixture.innerHTML, 'bar');

    r.set('foo', 'baz');
    t.htmlEqual(fixture.innerHTML, 'bar');
  });

  test(`null variable with a name of a missing partial doesn't break anything (#3154)`, t => {
    new Ractive({
      target: fixture,
      template: '1{{>part}}2',
      data: {
        part: null
      }
    });

    t.htmlEqual(fixture.innerHTML, '12');
  });

  test(`partial expressions that change and eval to the same name should not reset the partial (#3151)`, t => {
    let count = 0;
    let run = 0;
    const r = new Ractive({
      target: fixture,
      template: '{{>foo+bar+run()}}',
      partials: {
        foo: '{{check()}}'
      },
      data: {
        check() {
          return ++count;
        },
        run() {
          ++run;
          return '';
        },
        foo: 'fo',
        bar: 'o'
      }
    });

    t.htmlEqual(fixture.innerHTML, '1');
    t.equal(run, 1);

    r.set({ foo: 'f', bar: 'oo' });
    t.equal(run, 2);
    t.htmlEqual(fixture.innerHTML, '1');
  });

  // #3285
  test(`extending a component with pre-parsed partials should keep any expressions that was converted to function due to CSP #3285`, t => {
    const a = Ractive.parse(`{{1 + 2}}`, { csp: true });

    // after Ractive.extend, 1+2 should still return 5, rather than being re-evaluated to 3
    a.e['1+2'] = function() {
      return ['5'];
    };

    const MyComponent = {
      partials: { a }
    };

    const MyWrapper = Ractive.extend(MyComponent, {
      target: fixture,
      template: '{{>a}}'
    });

    new MyWrapper();

    t.htmlEqual(fixture.innerHTML, '5');
  });

  // #3285
  test(`pre-parsed partial expressions are converted and executed as a function in CSP #3285`, t => {
    const a = Ractive.parse(`{{1 + 2}}`, { csp: true });

    // after Ractive.extend, 1+2 should still return 5, rather than being re-evaluated to 3
    a.e['1+2'] = function() {
      return ['5'];
    };

    new Ractive({
      target: fixture,
      template: '{{>a}}',
      partials: { a }
    });

    t.htmlEqual(fixture.innerHTML, '5');
  });

  test(`partial with context and aliases`, t => {
    new Ractive({
      target: fixture,
      template: `{{#with foo}}{{>bar baz, 42 as foo}}{{/with}}`,
      partials: {
        bar: `{{.foo}} {{foo}}`
      },
      data: {
        foo: {
          baz: { foo: 99 }
        }
      }
    });

    t.htmlEqual(fixture.innerHTML, '99 42');
  });

  test(`yield with context and aliases #3316`, t => {
    const cmp = Ractive.extend({
      template: `{{yield part with baz, 'str' as lit, foo as param, fn() as fn}}`,
      partials: {
        part: `{{JSON.stringify(.)}}, {{lit}}, {{param}}, {{fn}}`
      },
      data() {
        return {
          fn() {
            return 'fn!';
          },
          foo: 'foo!',
          baz: { baz: 42 }
        };
      }
    });

    new Ractive({
      target: fixture,
      components: { cmp },
      template: '<cmp />'
    });

    t.htmlEqual(fixture.innerHTML, '{"baz":42}, str, foo!, fn!');
  });

  test(`dynamic partials retain context (#3297)`, t => {
    const r = new Ractive({
      target: fixture,
      template: `{{#each list}}{{#with ~/part}}{{>. ^^/}}{{/with}}{{/each}}`,
      partials: {
        foo: '(foo {{.}})',
        bar: '(bar {{.}})'
      },
      data: {
        list: [1, 2],
        part: 'foo'
      }
    });

    t.htmlEqual(fixture.innerHTML, '(foo 1)(foo 2)');

    r.set('part', 'bar');
    t.htmlEqual(fixture.innerHTML, '(bar 1)(bar 2)');
  });

  test(`manual yield via partial with context context finds correct parent element`, t => {
    const r = new Ractive({
      target: fixture,
      template: `<p>{{#with foo.bar}}<div />{{/with}}</p>{{#if !!.ctx}}<span {{>.bar .ctx}}></span>{{/if}}`,
      data: {
        foo: { bar: { baz: 'sure' } },
        bar: Ractive.parse('data-foo="{{.baz}}"', { attributes: true }).t
      }
    });

    r.set('ctx', r.getContext('div'));

    t.htmlEqual(fixture.innerHTML, '<p><div></div></p><span data-foo="sure"></span>');
  });
}

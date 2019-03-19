(function(global) {
    const DEBUG = true;
    const view_reg = /view|scroll-view|cover-view|swiper|swiper-item|checkbox-group|radio-group/;
    const span_reg = /text/;
    const image_reg = /image|cover-image/;
    const variable_in_value = /^(\ )*\{.*\}(\ )*$/;
    const array_reg = /^(\ )*\[.*\](\ )*$/;

    var debug = DEBUG ? console.log.bind(console) : function(){};

    if (typeof module === 'object' && typeof module.exports === 'object') {
        require('./htmlparser.js');
    }

    function q(v) {
        // 正则替换 值里面的 { }
        if(variable_in_value.test(v))return v;
        // 如果是 数组参数，用 {} 包裹
        if(array_reg.test(v))return '{' + v + '}';
        return '"' + v + '"';
    }

    function removeDOCTYPE(html) {
        return html
            .replace(/<\?xml.*\?>\n/, '')
            .replace(/<!doctype.*\>\n/, '')
            .replace(/<!DOCTYPE.*\>\n/, '');
    }

    global.html2json = function html2json(html) {
        html = removeDOCTYPE(html);
        var bufArray = [];
        var results = {
            node: 'root',
            child: [],
        };
        HTMLParser(html, {
            start: function(tag, attrs, unary) {
                debug(tag, attrs, unary);
                // node for this element
                var node = {
                    node: 'element',
                    tag: tag,
                };
                if (attrs.length !== 0) {
                    node.attr = attrs.reduce(function(pre, attr) {
                        var name = attr.name;
                        var value = attr.value;

                        // has multi attibutes
                        // make it array of attribute
                        if (value.match(/ /)) {
                            value = value.split(' ');
                        }

                        // if attr already exists
                        // merge it
                        if (pre[name]) {
                            if (Array.isArray(pre[name])) {
                                // already array, push to last
                                pre[name].push(value);
                            } else {
                                // single value, make it array
                                pre[name] = [pre[name], value];
                            }
                        } else {
                            // not exist, put it
                            pre[name] = value;
                        }

                        return pre;
                    }, {});
                }
                if (unary) {
                    // if this tag dosen't have end tag
                    // like <img src="hoge.png"/>
                    // add to parents
                    var parent = bufArray[0] || results;
                    if (parent.child === undefined) {
                        parent.child = [];
                    }
                    parent.child.push(node);
                } else {
                    bufArray.unshift(node);
                }
            },
            end: function(tag) {
                debug(tag);
                // merge into parent tag
                var node = bufArray.shift();
                if (node.tag !== tag) console.error('invalid state: mismatch end tag');

                if (bufArray.length === 0) {
                    results.child.push(node);
                } else {
                    var parent = bufArray[0];
                    if (parent.child === undefined) {
                        parent.child = [];
                    }
                    parent.child.push(node);
                }
            },
            chars: function(text) {
                debug(text);
                var node = {
                    node: 'text',
                    text: text,
                };
                if (bufArray.length === 0) {
                    results.child.push(node);
                } else {
                    var parent = bufArray[0];
                    if (parent.child === undefined) {
                        parent.child = [];
                    }
                    parent.child.push(node);
                }
            },
            comment: function(text) {
                debug(text);
                var node = {
                    node: 'comment',
                    text: text,
                };
                var parent = bufArray[0];
                if (parent.child === undefined) {
                    parent.child = [];
                }
                parent.child.push(node);
            },
        });
        return results;
    };

    global.json2html = function json2html(json) {
        // Empty Elements - HTML 4.01
        var empty = ['area', 'base', 'basefont', 'br', 'col', 'frame', 'hr', 'img', 'input', 'isindex', 'link', 'meta', 'param', 'embed'];

        var child = '';
        if (json.child) {
            child = json.child.map(function(c) {
                return json2html(c);
            }).join('');
        }

        if(json.node === 'element' && json.tag === "template"){
            // 是模板
            var attrs = "",tem_attr = {},component_name = json.attr["is"]||"";
            // 名称 各单词 首字母大写
            component_name = component_name.replace(/(\_|^)([a-z])/g,function ($1) {
                if($1.length ===1)return $1.toUpperCase();
                return $1.substring(1,2).toUpperCase();
            });
            tem_attr = JSON.parse(json.attr["data"].replace(/\'/g,'"').replace(/(\w+)\:/g,function($1){
                return '"'+ $1.substring(0,$1.length -1) + '":'
            }).replace(/\:(\w+)/g,function($1){
                return ':"'+ $1.substring(1) + '"'
            })); // 给所有的key 加 定界符" ,并且转换 成 json

            attrs = Object.keys(tem_attr).map(function (key) {
                var value =  tem_attr[key];
                if (typeof(value) === "object") value = JSON.stringify( tem_attr[key] );  // 数组类型的 转换成string
                return key + '=' + q(value);
            }).join(' ');
            if (attrs !== '') attrs = ' ' + attrs;
            return '<' + component_name + attrs + '/>'
        }

        var attr = '';
        if (json.attr) {
            attr = Object.keys(json.attr).map(function(key) {
                // 事件参数
                if(key.indexOf("data-")> -1)return "";

                var value = json.attr[key];
                if (Array.isArray(value)) value = value.join(' ');

                /*------------   替换 事件  start  ------------*/
                if(key.indexOf("tap")>=0){
                    return "onClick={this." + value + ".bind(this" + getParams(json.attr) + ")}"
                }else if(key.indexOf("bindblur")>=0){
                    return "onBlur={this." + value + ".bind(this" + getParams(json.attr) + ")}"
                }else if(key.indexOf("bindinput")>=0){
                    return "onChange={this." + value + ".bind(this" + getParams(json.attr) + ")}"
                }else if(key.indexOf("bindsubmit")>=0){
                    return "onSubmit={this." + value + ".bind(this" + getParams(json.attr) + ")}"
                }

                /*------------   替换 事件  end  ------------*/
                if(key==="class") key = "className";
                // 将 class 中的 image 替换成 img
                if( (key==="class" || key==="className") && value.indexOf("image")>-1) value= value.replace(/image/g,"img")
                return key + '=' + q(value);
            }).join(' ');
            if (attr !== '') attr = ' ' + attr;
        }

        if (json.node === 'element') {
            var tag = json.tag;
            if (empty.indexOf(tag) > -1) {
                // empty element
                return '<' + json.tag + attr + '/>';
            }

            /*-------  替换 wxml 标签  start  -----------*/

            if( view_reg.test(json.tag) ){
                json.origin_tag = json.tag;
                json.tag = "div";
            }else if(span_reg.test(json.tag)){
                json.origin_tag = json.tag;
                json.tag = "span";
            }else if(image_reg.test(json.tag)){
                json.origin_tag = json.tag;
                json.tag = "img";
            }

            /*-------  替换 wxml 标签  end  -----------*/


            // non empty element
            var open = '<' + json.tag + attr + '>';
            var close = '</' + json.tag + '>';
            return open + child + close;
        }

        if (json.node === 'text') {
            return json.text;
        }

        if (json.node === 'comment') {
            return '<!--' + json.text + '-->';
        }

        if (json.node === 'root') {
            return child;
        }
    };

    function getParams(attr_json){
        var _params = "";
        // 绑定属性
        Object.keys(attr_json).filter(function(_key,i){
            if(_key.indexOf("data-") > -1){
                _params += attr_json[_key].replace(/\{|\}/g,""); // 去掉定界符，只要value 当参数
            }
        });
        return (_params?" , "+_params : "")
    }
})(this);
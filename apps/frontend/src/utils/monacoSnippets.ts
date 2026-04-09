import type { Monaco } from "@monaco-editor/react";

export const registerMonacoSnippets = (monaco: Monaco) => {
    // We maintain a single registration per language to avoid duplicates if re-mounted
    const registeredLanguages = new Set<string>();

    const registerProvider = (language: string, snippets: any[]) => {
        if (registeredLanguages.has(language)) return;

        monaco.languages.registerCompletionItemProvider(language, {
            provideCompletionItems: (model, position) => {
                const word = model.getWordUntilPosition(position);
                const range = {
                    startLineNumber: position.lineNumber,
                    endLineNumber: position.lineNumber,
                    startColumn: word.startColumn,
                    endColumn: word.endColumn,
                };
                
                return {
                    suggestions: snippets.map(snippet => ({
                        ...snippet,
                        range,
                        kind: monaco.languages.CompletionItemKind.Snippet,
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    }))
                };
            }
        });
        registeredLanguages.add(language);
    };

    // JAVASCRIPT
    registerProvider("javascript", [
        {
            label: 'clg',
            insertText: 'console.log(${1:object});',
            documentation: 'Log output to console',
        },
        {
            label: 'forloop',
            insertText: 'for (let ${1:i} = 0; ${1:i} < ${2:array}.length; ${1:i}++) {\n\t${3}\n}',
            documentation: 'Basic for loop',
        },
        {
            label: 'arrowfunc',
            insertText: 'const ${1:name} = (${2:params}) => {\n\t${3}\n};',
            documentation: 'Arrow function',
        },
        {
            label: 'ifstmt',
            insertText: 'if (${1:condition}) {\n\t${2}\n}',
            documentation: 'If statement',
        }
    ]);

    // PYTHON
    registerProvider("python", [
        {
            label: 'pr',
            insertText: 'print(${1:object})',
            documentation: 'Print to standard output',
        },
        {
            label: 'def',
            insertText: 'def ${1:name}(${2:args}):\n\t${3:pass}',
            documentation: 'Function definition',
        },
        {
            label: 'forloop',
            insertText: 'for ${1:item} in ${2:iterable}:\n\t${3:pass}',
            documentation: 'For loop',
        },
        {
            label: 'main',
            insertText: 'if __name__ == "__main__":\n\t${1:main()}',
            documentation: 'Main entry point',
        }
    ]);

    // C++
    registerProvider("cpp", [
        {
            label: 'cout',
            insertText: 'std::cout << ${1:value} << std::endl;',
            documentation: 'Print stream',
        },
        {
            label: 'main',
            insertText: 'int main() {\n\t${1}\n\treturn 0;\n}',
            documentation: 'Main function',
        },
        {
            label: 'forloop',
            insertText: 'for (int ${1:i} = 0; ${1:i} < ${2:count}; ++${1:i}) {\n\t${3}\n}',
            documentation: 'For loop',
        },
        {
            label: 'include',
            insertText: '#include <${1:iostream}>',
            documentation: 'Include directive',
        }
    ]);

    // JAVA
    registerProvider("java", [
        {
            label: 'sout',
            insertText: 'System.out.println(${1:object});',
            documentation: 'Print to standard output',
        },
        {
            label: 'psvm',
            insertText: 'public static void main(String[] args) {\n\t${1}\n}',
            documentation: 'Main method',
        },
        {
            label: 'forloop',
            insertText: 'for (int ${1:i} = 0; ${1:i} < ${2:count}; ${1:i}++) {\n\t${3}\n}',
            documentation: 'For loop',
        },
        {
            label: 'class',
            insertText: 'public class ${1:Name} {\n\t${2}\n}',
            documentation: 'Class definition',
        }
    ]);

    // RUST
    registerProvider("rust", [
        {
            label: 'pln',
            insertText: 'println!("${1:{}}", ${2:var});',
            documentation: 'Print macro',
        },
        {
            label: 'main',
            insertText: 'fn main() {\n\t${1}\n}',
            documentation: 'Main function',
        },
        {
            label: 'forloop',
            insertText: 'for ${1:i} in ${2:0..10} {\n\t${3}\n}',
            documentation: 'For loop',
        },
        {
            label: 'match',
            insertText: 'match ${1:variable} {\n\t${2:pattern} => ${3:expression},\n\t_ => ${4:fallback},\n}',
            documentation: 'Match pattern',
        }
    ]);

    // GO
    registerProvider("go", [
        {
            label: 'fmtp',
            insertText: 'fmt.Println(${1:object})',
            documentation: 'Print line',
        },
        {
            label: 'main',
            insertText: 'func main() {\n\t${1}\n}',
            documentation: 'Main function',
        },
        {
            label: 'forloop',
            insertText: 'for ${1:i} := 0; ${1:i} < ${2:count}; ${1:i}++ {\n\t${3}\n}',
            documentation: 'For loop',
        },
        {
            label: 'iferr',
            insertText: 'if err != nil {\n\t${1:return err}\n}',
            documentation: 'Error check',
        }
    ]);
};

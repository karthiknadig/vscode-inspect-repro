import * as vscode from 'vscode';
import { expect } from 'chai';
suite('Verify settings inspection', () => {
    setup(async () => {
        const extension = vscode.extensions.getExtension('vscode-inspect-repro');
        await extension?.activate();
    });
    teardown(() => {});
    test('Inspect', async () => {
        const config = vscode.workspace.getConfiguration('python');
        let resolve: (value: void | PromiseLike<void>) => void;
        let reject: (reason?: any) => void;
        let skipReject = false;
        const changed = new Promise<void>((res, rej) => {
            resolve = res;
            reject = rej;
        });
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('python.pythonPath')) {
                skipReject = true;
                resolve();
            }
        });
        setTimeout(() => {
            if (!skipReject) {
                reject();
            }
        }, 1000);

        const expectPath = `something-new-${Date.now()}`;
        config.update('pythonPath', expectPath);
        await changed;

        const newConfig = vscode.workspace.getConfiguration('python');
        expect(newConfig.get<string>('pythonPath')).to.be.equal(expectPath);
        const inspect = newConfig.inspect<string>('pythonPath');
        expect(inspect?.workspaceValue).to.be.equal(expectPath);
    });
});

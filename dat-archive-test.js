
const expect = chai.expect;

async function expectPromiseRejected(asyncFunc) {
  return new Promise((resolve, reject) => {
    asyncFunc.then(reject, resolve);
  });
}

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe('DatArchive API test', () => {

  it('exists', () => {
    expect(window.DatArchive).to.exist;
  });

  describe('constructor', () => {

    it('creates a DatArchive from dat url', () => {
      const url = 'dat://e4c533bb9e4beaed718e4be9c28b6da88f88df55aee5640518b110dfb0be26b7/';
      expect(new DatArchive(url)).to.not.be.null;
    });

    it('throws an Error for a http url', () => {
      const url = 'http://e4c533bb9e4beaed718e4be9c28b6da88f88df55aee5640518b110dfb0be26b7/';
      expect(() => new DatArchive(url)).to.throw;
    });

    it('throws an Error for non string arguments', () => {
      expect(() => new DatArchive(false)).to.throw;
    });
  });

  describe('DatArchive readonly', () => {

    let archiveUrl = 'dat://e4c533bb9e4beaed718e4be9c28b6da88f88df55aee5640518b110dfb0be26b7';
    const testFile = 'test.txt';
    const testFileContents = 'Test getting content from file, äü\r\n';
    let archive;

    beforeEach(() => {
      archive = new DatArchive(archiveUrl);
    });

    describe('.url', () => {
      it('contains the archive\'s url', () => {
        expect(archive.url).to.equal(archiveUrl);
      });

      it('has trailing slash removed', () => {
        archive = new DatArchive(`${archiveUrl}/`);
        expect(archive.url).to.equal(archiveUrl);
      });

      it('removes trailing path from archive url', () => {
        archive = new DatArchive(`${archiveUrl}/test#first`);
        expect(archive.url).to.equal(archiveUrl);
      });
    });

    describe('getInfo()', () => {
      it('fetches information about the archive', async () => {
        const info = await archive.getInfo();
        expect(info.key).to.equal(archiveUrl.substring(6));
        expect(info.url).to.equal(archiveUrl);
        expect(info.title).to.equal('DatArchive Tests');
        expect(info.description).to.equal('Tests for DatArchive API');
        // other properties
        ['version', 'peers', 'isOwner', 'mtime'].forEach((p) => {
          expect(info).to.have.property(p);
        });
      });
    });

    describe('configure()', () => {

      it('rejects with error', () => {
        return expectPromiseRejected(archive.configure({ title: 'new title' }));
      });
    });

    describe('stat()', () => {
      it('fetches information about a file', async () => {
        const stat = await archive.stat(testFile);
        expect(stat.isFile()).to.be.true;
        expect(stat.isDirectory()).to.be.false;
        ['size', 'blocks', 'downloaded', 'mtime', 'ctime'].forEach((p) => {
          expect(stat).to.have.property(p);
        });
        expect(stat.size).to.equal(38);
      });

      it('fetches information about a directory', async () => {
        const stat = await archive.stat('node_modules');
        expect(stat.isFile()).to.be.false;
        expect(stat.isDirectory()).to.be.true;
        ['size', 'blocks', 'downloaded', 'mtime', 'ctime'].forEach((p) => {
          expect(stat).to.have.property(p);
        });
      });

      it('rejects promise if file does not exist', () => {
        expect(() => archive.stat('nonexistant')).to.throw;
      });
    });

    describe('readFile()', () => {

      it('reads file contents (default)', async () => {
        const contents = await archive.readFile(testFile);
        expect(contents).to.equal(testFileContents);
      });

      it('reads file contents (utf-8)', async () => {
        const contents = await archive.readFile(testFile, { encoding: 'utf8' });
        expect(contents).to.equal(testFileContents);
      });

      it('reads file contents (base64)', async () => {
        const contents = await archive.readFile(testFile, { encoding: 'base64' });
        expect(contents).to.equal('VGVzdCBnZXR0aW5nIGNvbnRlbnQgZnJvbSBmaWxlLCDDpMO8DQo=');
      });

      it('reads file contents (hex)', async () => {
        const contents = await archive.readFile(testFile, { encoding: 'hex' });
        expect(contents).to.equal('546573742067657474696e6720636f6e74656e742066726f6d2066696c652c20c3a4c3bc0d0a');
      });

      it('reads file contents (binary)', async () => {
        const contents = await archive.readFile(testFile, { encoding: 'binary' });
        const binaryContents = new TextEncoder('utf-8').encode(testFileContents);
        expect(contents).to.be.a('arraybuffer');
        expect(contents.byteLength).to.equal(binaryContents.byteLength);
        expect(new Uint8Array(contents).toString()).to.equal(new Uint8Array(binaryContents).toString());
      });
    });

    describe('readdir()', () => {

      const expectedFiles = ['node_modules', 'dat-archive-test.js', 'dat.json', 'index.html', 'package-lock.json', 'package.json', 'test.txt'];

      it('reads contents of the directory as an array', async () => {
        const files = await archive.readdir('/');
        expect(files).to.have.length(expectedFiles.length);
        expect(files).to.have.members(expectedFiles);
      });

      it('opts.recursive returns a recursive listing', async () => {
        const files = await archive.readdir('/node_modules/chai/lib', { recursive: true });
        expect(files).to.contain('chai.js');
        expect(files).to.contain('chai/core/assertions.js');
        expect(files).to.contain('chai/core');
      });

      it('opts.recursive lists directories with unix-style (/) separators, no preceding slash', async () => {
        const files = await archive.readdir('/node_modules/chai/lib', { recursive: true });
        expect(files).to.contain('chai/core/assertions.js');
      });

      it('opts.recursive lists nested files with windows-style (\\) separators, with preceding slash', async () => {
        const files = await archive.readdir('\\node_modules\\chai\\lib', { recursive: true });
        expect(files).to.contain('\\chai\\core\\assertions.js');
      });

      it('opts.stat returns an array of stat objects', async () => {
        const files = await archive.readdir('/', { stat: true });
        expect(files).to.have.length(expectedFiles.length);
        files.forEach((f) => {
          expect(f).to.be.a('object');
          expect(f).to.have.property('name');
          expect(f).to.have.property('stat');
          expect(f.name).to.be.a('string');
          expect(f.stat).to.be.a('object');
        })
      });
    });

    describe('history()', () => {

      it('fetches an array of all changes', async () => {
        const history = await archive.history();
        expect(history).to.be.a('array');
        history.forEach((change) => {
          expect(change.path).to.be.a('string');
          expect(change.version).to.be.a('number');
          expect(change.type).to.be.oneOf(['put', 'del'])
        });
      });

      it('change list is in ascending order', async () => {
        const history = await archive.history();
        expect(history[0].version).to.equal(1);
        expect(history[history.length - 1].version > 1).to.be.true;
      });

      it('opts.reverse returns changes in decending order', async () => {
        const history = await archive.history({ reverse: true });
        expect(history[history.length - 1].version).to.equal(1);
        expect(history[0].version > 1).to.be.true;
      });

      it('start and end return a slice of the history array (including version start and excluding version end)', async () => {
        const history = await archive.history({ start: 5, end: 10 });
        expect(history.length).to.equal(5);
        expect(history[0].version).to.equal(5);
        expect(history[history.length -1].version).to.equal(9);
      });

      it('end before start throws an exception', () => {
        return expectPromiseRejected(archive.history({ start: 5, end: 1, timeout: 500 }));
      });

      it('negative start is assumed to be 0', async () => {
        const history = await archive.history({ start: -4, end: 5 });
        expect(history.length).to.equal(4);
        expect(history[0].version).to.equal(1);
      });

      it('negative start and end: returns all', async () => {
        const history = await archive.history({ start: -5, end: -1 });
        expect(history).to.be.a('array');
      });
    });
  });

  describe('DatArchive write access', () => {

    let archiveAddress;
    let archive;

    before(async function() {
      // create an archive for use to work with
      archiveAddress = localStorage.getItem('testArchive');
      if (!archiveAddress) {
        this.timeout(60000);
        const archive = await DatArchive.create({
          title: 'DatArchive write test',
          description: 'for DatArchive test suite',
        });
        localStorage.setItem('testArchive', archive.url);
        archiveAddress = archive.url;
      }
    });

    beforeEach(() => {
      archive = new DatArchive(archiveAddress);
    });

    describe('getInfo()', () => {
      it('isOwner is true', async () => {
        const info = await archive.getInfo();
        expect(info.isOwner).to.be.true;
      });
    });

    describe('configure()', () => {

      let originalManifest;

      beforeEach(async () => {
        originalManifest = await archive.getInfo();
      });

      afterEach(async () => {
        await archive.configure({
          title: originalManifest.title,
          description: originalManifest.description,
        });
      });

      it('updates the dat.json manifest', async () => {
        const newTitle = 'a new title';
        const newDesc = 'some other description';
        await archive.configure({ title: newTitle, description: newDesc });
        const manifest = JSON.parse(await archive.readFile('dat.json'));
        expect(manifest.title).to.equal(newTitle);
        expect(manifest.description).to.equal(newDesc);
      });
    });

    describe('copy()', () => {

      context('file', () => {
        afterEach(async () => {
          await archive.unlink('copy of dat.json');
        });

        it('copies a file', async () => {
          await archive.copy('dat.json', 'copy of dat.json');
          expect(await archive.readFile('copy of dat.json')).to.equal(await archive.readFile('dat.json'));
        });

        it('overwrites if copy destination already exists', async () => {
          // put content in target, then copy something else to it
          await archive.writeFile('copy of dat.json', '{}');
          await archive.copy('dat.json', 'copy of dat.json');
          expect(await archive.readFile('copy of dat.json')).to.equal(await archive.readFile('dat.json'));
        });

      });

      context('directory', () => {

        beforeEach(async () => {
          await archive.mkdir('test');
          await archive.writeFile('test/data.txt', 'some data in a file');
        });

        it('copies a directory', async () => {
          await archive.copy('test', 'copy of test');
          // copied files exist
          expect((await archive.stat('copy of test')).isDirectory()).to.be.true;
          expect((await archive.stat('copy of test/data.txt')).isFile()).to.be.true;
          // original files exist
          expect((await archive.stat('test')).isDirectory()).to.be.true;
          expect((await archive.stat('test/data.txt')).isFile()).to.be.true;
        });

        it('merges with destination folder if it already exists', async () => {
          // prepare existing target dir
          await archive.copy('test', 'copy of test');
          await archive.writeFile('copy of test/otherfile.json', '{}');
          await archive.writeFile('copy of test/data.txt', 'new content');

          // copy on top of the directory
          await archive.copy('test', 'copy of test');
          expect(await archive.readdir('copy of test')).to.have.length(2);
          expect(await archive.readFile('copy of test/data.txt')).to.equal('some data in a file');
          expect(await archive.readFile('copy of test/otherfile.json')).to.equal('{}');
        });

        afterEach(async () => {
          await archive.unlink('test/data.txt');
          await archive.rmdir('test');
          await Promise.all((await archive.readdir('copy of test')).map(f => archive.unlink(`copy of test/${f}`)));
          await archive.rmdir('copy of test');
        });
      });

      it('rejects if copy source does not exist', () => {
        return expectPromiseRejected(archive.copy('nonexistant', 'existant'));
      });
    });

    describe('writeFile()', () => {

      const testFile = 'test.txt';

      afterEach(async () => {
        try {
          await archive.unlink(testFile);
        } catch(e) {}
      });

      it('writes data to file', async () => {
        const dataToWrite = 'some data to write äü\r\n';
        await archive.writeFile(testFile, dataToWrite);
        expect(await archive.readFile(testFile)).to.equal(dataToWrite);
      });

      it('writes data to file (base64)', async () => {
        const dataToWrite = btoa('some data to write äü\r\n');
        await archive.writeFile(testFile, dataToWrite, { encoding: 'base64' });
        expect(await archive.readFile(testFile, { encoding: 'base64' })).to.equal(dataToWrite);
      });

      it('writes data to file (hex)', async () => {
        const dataToWrite = 'some data to write äü\r\n'.split('')
          .map((v, ind) => ('0' + (v.charCodeAt(0)).toString(16)).slice(-2)).join('');
        await archive.writeFile(testFile, dataToWrite, { encoding: 'hex' });
        expect(await archive.readFile(testFile, { encoding: 'hex' })).to.equal(dataToWrite);
      });

      it('writes data to file (binary)', async () => {
        const dataToWrite = Uint8Array.from([97, 98, 99, 100]);
        await archive.writeFile(testFile, dataToWrite.buffer, { encoding: 'binary' });
        const readData = await archive.readFile(testFile, { encoding: 'binary' })
        expect(new Uint8Array(readData).toString()).to.equal(dataToWrite.toString());
      });

      it('writes binary if data is an ArrayBuffer', async () => {
        const dataToWrite = Uint8Array.from([97, 98, 99, 100]);
        await archive.writeFile(testFile, dataToWrite.buffer);
        const readData = await archive.readFile(testFile, { encoding: 'binary' })
        expect(new Uint8Array(readData).toString()).to.equal(dataToWrite.toString());
      });

      it('rejects if parent directory does not exist', () => {
        expectPromiseRejected(archive.writeFile('/dir1/test.txt', 'some content'));
      });
    });

    describe('mkdir()', () => {

      const testDir = 'folder';

      afterEach(async () => {
        try {
          await archive.rmdir(testDir);
        } catch(e) {}
      });

      it('creates a directory', async () => {
        await archive.mkdir(testDir);
        expect((await archive.stat(testDir)).isDirectory()).to.be.true;
      });

      it('rejects if parent dir does not exist', () => {
        return expectPromiseRejected(archive.mkdir('/dir1/folder'));
      });

      it('rejects if directory already exists', async () => {
        await archive.mkdir(testDir);
        await expectPromiseRejected(archive.mkdir(testDir));
      });
    });

    describe('unlink()', () => {

      it('deletes the specified file', async () => {
        const path = 'test.txt';
        await archive.writeFile(path, 'some content');
        await archive.unlink(path);
        await expectPromiseRejected(archive.stat(path));
      });

      it('rejects if file does not exist', () => {
        return expectPromiseRejected(archive.unlink('nonexistant'));
      });
    });

    describe('rmdir()', () => {

      it('delete an empty directory', async () => {
        const dir = 'folder';
        await archive.mkdir(dir);
        await archive.rmdir(dir);
        const folderExists = (await archive.readdir('/')).indexOf(dir) !== -1;
        expect(folderExists).to.be.false;
      });

      it('rejects if directory does not exist', () => {
        return expectPromiseRejected(archive.rmdir('nonexistant'));
      });

      context('directory not empty', () => {
        const dir = 'folder';
        const file = `${dir}/test.txt`;

        beforeEach(async () => {
          await archive.mkdir(dir);
          await archive.writeFile(file, 'content');
        });

        it('rejects', () => {
          return expectPromiseRejected(archive.rmdir(dir));
        });

        afterEach(async () => {
          await archive.unlink(file);
          await archive.rmdir(dir);
        });
      });
    });

    describe('rename()', () => {

      const fileContents = 'some data in a file';

      context('file', () => {

        beforeEach(async () => {
          await archive.writeFile('data.txt', fileContents);
        });

        afterEach(async () => {
          await archive.unlink('data2.txt');
        });

        it('renames a file', async () => {
          await archive.rename('data.txt', 'data2.txt');
          expect(await archive.readFile('data2.txt')).to.equal(fileContents);
          expect(await archive.readdir('/')).to.not.contain('data.txt');
        });

        it('rejects destination already exists', async () => {
          // put content in target, then copy something else to it
          await archive.writeFile('data2.txt', '{}');
          return expectPromiseRejected(archive.rename('data.json', 'data2.txt'));
        });
      });

      context('directory', () => {

        beforeEach(async () => {
          await archive.mkdir('test');
          await archive.writeFile('test/data.txt', fileContents);
        });

        it('renames a directory', async () => {
          await archive.rename('test', 'copy of test');
          // copied files exist
          expect((await archive.stat('copy of test')).isDirectory()).to.be.true;
          expect((await archive.stat('copy of test/data.txt')).isFile()).to.be.true;
          // original files do not exist
          expect(await archive.readdir('/')).to.not.contain('test');
        });

        it('rejects if destination folder already exists', async () => {
          // prepare existing target dir
          await archive.mkdir('copy of test');
          await archive.writeFile('copy of test/data.txt', 'new content');

          return expectPromiseRejected(archive.rename('test', 'copy of test'));
        });

        afterEach(async () => {
          try {
            await Promise.all((await archive.readdir('test')).map(f => archive.unlink(`test/${f}`)));
            await archive.rmdir('test');
          } catch(e) {}
          try {
            await Promise.all((await archive.readdir('copy of test')).map(f => archive.unlink(`copy of test/${f}`)));
            await archive.rmdir('copy of test');
          } catch(e) {}
        });
      });

      it('rejects if source does not exist', () => {
        return expectPromiseRejected(archive.rename('nonexistant', 'existant'));
      });
    });

    describe('createFileActivitySteam()', () => {

      afterEach(async () => {
        const files = await archive.readdir('/');
        const deletions = ['watch.txt', 'watch2.txt', 'dont_watch.txt']
        .map(async (file) => {
          if (files.indexOf(file) !== -1) {
            await archive.unlink(file);
          }
        });
        await Promise.all(deletions);
      });

      context('without pattern', () => {
        let stream;

        afterEach(() => {
          stream.close();
        });

        it('changed event triggers when file is changed; path has preceeding slash', async () => {
          stream = archive.createFileActivityStream();
          const test = new Promise((resolve) => {
            stream.addEventListener('changed', resolve);
          });
          await wait(500);
          archive.writeFile('watch.txt', 'a');
          return test.then((ev) => {
            expect(ev.path).to.equal('/watch.txt');
          });
        });

        it('does not trigger if not files are changed', () => {
          stream = archive.createFileActivityStream();
          return new Promise((resolve, reject) => {
            stream.addEventListener('changed', reject);
            setTimeout(resolve, 100);
          });
        });

        it('triggers for the last event before the listener is registered', async () => {
          stream = archive.createFileActivityStream();
          await archive.writeFile('dont_watch.txt', 'b');
          await archive.writeFile('watch.txt', 'a');

          const test = new Promise((resolve) => {
            stream.addEventListener('changed', resolve);
          });
          return test.then((ev) => {
            expect(ev.path).to.equal('/watch.txt');
          });
        });

        it('does not trigger for events before stream creation', async () => {
          await archive.writeFile('watch.txt', 'a');
          stream = archive.createFileActivityStream();
          const test = new Promise((resolve, reject) => {
            stream.addEventListener('changed', reject);
            setTimeout(resolve, 100);
          });
          return test;
        });

        it('triggers for all paths', async () => {
          stream = archive.createFileActivityStream();
          const test = new Promise((resolve) => {
            const events = []
            stream.addEventListener('changed', (ev) => {
              events.push(ev);
              console.log(ev);
              if (events.length === 3) {
                resolve(events);
              }
            });
          });
          await wait(500);

          await archive.writeFile('watch.txt', 'a');
          await archive.writeFile('dont_watch.txt', 'b');
          await archive.writeFile('watch.txt', 'b');

          return test.then((events) => {
            expect(events).to.have.length(3);
            expect(events.filter((ev => ev.path === '/watch.txt'))).to.have.length(2);
            expect(events.filter((ev => ev.path === '/dont_watch.txt'))).to.have.length(1);
          });
        });
      });

      context('with string pattern', () => {
        let stream;

        afterEach(() => {
          stream.close();
        });

        it('triggers only for provided path', async () => {
          // note, preceeding / is required
          stream = archive.createFileActivityStream('/watch.txt');
          const test = new Promise((resolve) => {
            const events = []
            stream.addEventListener('changed', (ev) => {
              events.push(ev);
              console.log(ev);
              if (events.length === 2) {
                resolve(events);
              }
            });
          });
          await wait(500);

          await archive.writeFile('watch.txt', 'a');
          await archive.writeFile('dont_watch.txt', 'b');
          await archive.writeFile('watch.txt', 'b');

          return test.then((events) => {
            expect(events).to.have.length(2);
            expect(events.filter((ev => ev.path === '/watch.txt'))).to.have.length(2);
            expect(events.filter((ev => ev.path === '/dont_watch.txt'))).to.have.length(0);
          });
        });
      });

      context('with array of patterns', () => {
        let stream;

        afterEach(() => {
          stream.close();
        });

        it('matches for set of paths', async () => {
          // note, preceeding / is required
          stream = archive.createFileActivityStream(['/watch.txt', '/watch2.txt']);
          const test = new Promise((resolve) => {
            const events = []
            stream.addEventListener('changed', (ev) => {
              events.push(ev);
              console.log(ev);
              if (events.length === 2) {
                resolve(events);
              }
            });
          });
          await wait(500);

          await archive.writeFile('watch.txt', 'a');
          await archive.writeFile('dont_watch.txt', 'b');
          await archive.writeFile('watch2.txt', 'b');

          return test.then((events) => {
            expect(events).to.have.length(2);
            const paths = events.map(ev => ev.path);
            expect(paths).to.contain('/watch.txt');
            expect(paths).to.contain('/watch2.txt');
          });
        });

        it('matches for anymatch patterns', async () => {
          // note, preceeding / is required
          stream = archive.createFileActivityStream(['/*watch.txt']);
          const test = new Promise((resolve) => {
            const events = []
            stream.addEventListener('changed', (ev) => {
              events.push(ev);
              console.log(ev);
              if (events.length === 2) {
                resolve(events);
              }
            });
          });
          await wait(500);

          await archive.writeFile('watch.txt', 'a');
          await archive.writeFile('watch2.txt', 'b');
          await archive.writeFile('dont_watch.txt', 'b');

          return test.then((events) => {
            expect(events).to.have.length(2);
            const paths = events.map(ev => ev.path);
            expect(paths).to.contain('/watch.txt');
            expect(paths).to.contain('/dont_watch.txt');
          });
        });
      });
    });
  });
});
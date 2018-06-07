
const expect = chai.expect;

async function expectPromiseRejected(asyncFunc) {
  return new Promise((resolve, reject) => {
    asyncFunc.then(reject, resolve);
  });
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
      afterEach(async () => {
        await archive.unlink('copy of dat.json');
      });
  
      it('copies a file', async () => {
        await archive.copy('dat.json', 'copy of dat.json');
        expect(await archive.readFile('copy of dat.json')).to.equal(await archive.readFile('dat.json'));
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
  });
});
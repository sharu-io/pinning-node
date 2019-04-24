import * as ipfsControl from '../ipfsControl'

/*
with js-ipfs 0.35 ls on directory does not return the size of the dir anymore

two obvious ways of doing it now: stat the file (part of MFS, but does work with remote files too) 

  -> await ipfsApi.files.stat(path)
      { type: 'directory',
        blocks: 2,
        size: 0,
        hash: 'QmboLBX13WVg63FUiA8DDCqAR5Ssu6N9WYK9hyp1J11fKK',
        cumulativeSize: 2435136935,
        withLocality: false,
        local: undefined,
        sizeLocal: undefined }

*/

ipfsControl.init({runAsMaster: false}).then(async ipfsApi => {
    const shareHash = 'QmboLBX13WVg63FUiA8DDCqAR5Ssu6N9WYK9hyp1J11fKK'; 
    const path = `/ipfs/${shareHash}`;

    console.log(`stats for ${path}`);
    const stats = await ipfsApi.files.stat(path);
    console.log(stats);
});
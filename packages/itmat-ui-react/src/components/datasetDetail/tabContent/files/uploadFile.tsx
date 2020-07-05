import React from 'react';
import { useApolloClient, useMutation, useQuery } from 'react-apollo';
import { UPLOAD_FILE, GET_STUDY, WHO_AM_I, LOG_ACTION, WRITE_LOG, LOG_STATUS } from 'itmat-commons';
import { logFun } from '../../../../utils/logUtils';

export const UploadFileSection: React.FunctionComponent<{ studyId: string }> = ({ studyId }) => {
    const [description, setDescription] = React.useState('');
    const [error, setError] = React.useState('');
    const [success, setSuccess] = React.useState(false);
    const [logData, setLogData] = React.useState({});
    const fileRef = React.createRef();
    const store = useApolloClient();
    const [uploadFile, { loading }] = useMutation(UPLOAD_FILE, {
        onCompleted: ({ uploadFile }) => {
            // logging
            logFun(writeLog, whoamidata, LOG_ACTION.UPLOAD_FILE, logData, LOG_STATUS.SUCCESS);
            setDescription('');
            setError('');
            setSuccess(true);
            const cachedata = store.readQuery({ query: GET_STUDY, variables: { studyId } }) as any;
            if (!cachedata) { return; }
            const newcachedata = { ...cachedata.getStudy, files: [...cachedata.getStudy.files, uploadFile] };
            store.writeQuery({ query: GET_STUDY, variables: { studyId }, data: { getStudy: newcachedata } });
        },
        onError: (err) => {
            logFun(writeLog, whoamidata, LOG_ACTION.UPLOAD_FILE, {ERROR: err}, LOG_STATUS.FAIL);
        }
    });

    // prepare for logging
    const [writeLog, { loading: writeLogLoading }] = useMutation(WRITE_LOG);
    const { loading: whoamiloading, error: whoamierror, data: whoamidata } = useQuery(WHO_AM_I);
    if (whoamiloading) { return <p>Loading..</p>; }
    if (whoamierror) { return <p>ERROR: please try again.</p>; }

    return <div>
        <label>Select file: <input type='file' ref={fileRef as any} /></label><br /><br />
        <label>Description: <input type='text' value={description} onChange={(e) => { setDescription(e.target.value); setError(''); setSuccess(false); }} /></label>
        <br /><br /><br />
        {
            (loading && writeLogLoading) ? <button>Loading...</button> :
                <button onClick={() => {
                    if ((fileRef.current! as any).files.length === 0) {
                        setError('You must select a file.');
                        setSuccess(false);
                        return;
                    }

                    if (description === '') {
                        setError('You must provide description.');
                        setSuccess(false);
                        return;
                    }

                    const file = (fileRef.current! as any).files[0];
                    uploadFile({ variables: { file, studyId, description, fileLength: file.size } });
                    setLogData({studyId: studyId, fileName: file.name});

                }}>Upload</button>
        }
        {error ? <div className='error_banner'>{error}</div> : null}
        {success ? <div className='saved_banner'>Uploaded.</div> : null}
    </div>;
};

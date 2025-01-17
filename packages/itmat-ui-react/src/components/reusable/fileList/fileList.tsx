import { FunctionComponent, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client/react/hooks';
import { Table, Button, notification, Tooltip } from 'antd';
import { DELETE_FILE, WHO_AM_I, GET_ORGANISATIONS, GET_USERS } from '@itmat-broker/itmat-models';
import { IFile, userTypes } from '@itmat-broker/itmat-types';
import { DeleteOutlined, CloudDownloadOutlined, SwapRightOutlined, NumberOutlined } from '@ant-design/icons';
import { ApolloError } from '@apollo/client/errors';
import dayjs from 'dayjs';
import { deviceTypes } from '@itmat-broker/itmat-types';
import Highlighter from 'react-highlight-words';
import LoadSpinner from '../loadSpinner';

export function formatBytes(size: number, decimal = 2): string {
    if (size === 0) {
        return '0 B';
    }
    const base = 1024;
    const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const order = Math.floor(Math.log(size) / Math.log(base));
    return parseFloat((size / Math.pow(base, order)).toFixed(decimal)) + ' ' + units[order];
}

export const FileList: FunctionComponent<{ files: IFile[], searchTerm: string | undefined, isStudyLevel?: boolean }> = ({ files, searchTerm, isStudyLevel }) => {
    const [isDeleting, setIsDeleting] = useState<{ [key: string]: boolean }>({});
    const { data: dataWhoAmI, loading: loadingWhoAmI } = useQuery(WHO_AM_I);
    const [deleteFile] = useMutation(DELETE_FILE, {
        errorPolicy: 'ignore',
        onError: (error: ApolloError) => {
            notification.error({
                message: 'Deletion error!',
                description: error.message ?? 'Unknown Error Occurred!',
                placement: 'topRight',
                duration: 0
            });
        }
    });
    const { loading: getOrgsLoading, error: getOrgsError, data: getOrgsData } = useQuery(GET_ORGANISATIONS);
    const { loading: getUsersLoading, error: getUsersError, data: getUsersData } = useQuery(GET_USERS, { variables: { fetchDetailsAdminOnly: false, fetchAccessPrivileges: false } });

    const deletionHandler = (fileId: string) => {
        setIsDeleting({
            ...isDeleting,
            [fileId]: true
        });
        deleteFile({
            variables: {
                fileId
            },
            refetchQueries: ['getStudy']
        });
    };

    if (getOrgsLoading || getUsersLoading)
        return <LoadSpinner />;

    if (getOrgsError || getUsersError)
        return <>An error occured, please contact your administrator: {(getOrgsError as any).message} {(getUsersError as any).message}</>;

    const userIdNameMapping = getUsersData.getUsers.reduce((a, b) => { a[b['id']] = b['firstname'].concat(' ').concat(b['lastname']); return a; }, {});

    const sites = getOrgsData.getOrganisations.filter(org => org.metadata?.siteIDMarker).reduce((prev, current) => ({
        ...prev,
        [current.metadata.siteIDMarker]: current.shortname ?? current.name
    }), {});

    const fileDetailsColumns = [
        {
            title: 'Participant ID',
            dataIndex: 'participantId',
            key: 'participantId',
            render: (__unused__value, record) => {
                const participantId = record.metadata?.participantId;
                if (searchTerm)
                    return <Highlighter searchWords={[searchTerm]} textToHighlight={participantId} highlightStyle={{
                        backgroundColor: '#FFC733',
                        padding: 0
                    }} />;
                else
                    return participantId;
            },
            sorter: (a, b) => a.metadata?.participantId.localeCompare(b.metadata?.participantId)
        },
        {
            title: 'Site',
            key: 'site',
            render: (__unused__value, record) => {
                const site = sites[record.metadata.participantId[0]];
                if (searchTerm)
                    return <Highlighter searchWords={[searchTerm]} textToHighlight={site} highlightStyle={{
                        backgroundColor: '#FFC733',
                        padding: 0
                    }} />;
                else
                    return site;
            },
            sorter: (a, b) => a.metadata.participantId.localeCompare(b.metadta).participantId
        },
        {
            title: 'Device ID',
            dataIndex: 'deviceId',
            key: 'deviceId',
            render: (__unused__value, record) => {
                const deviceId = record.metadata?.deviceId ?? 'NA';
                if (searchTerm)
                    return <Highlighter searchWords={[searchTerm]} textToHighlight={deviceId} highlightStyle={{
                        backgroundColor: '#FFC733',
                        padding: 0
                    }} />;
                else
                    return deviceId;
            },
            sorter: (a, b) => (a.metadata?.deviceId ?? 'NA').localeCompare(b.metadata?.deviceId ?? 'NA')
        },
        {
            title: 'Device Type',
            key: 'deviceType',
            render: (__unused__value, record) => {
                const deviceType = deviceTypes[record.metadata?.deviceId?.substr(0, 3) ?? 'NA'] ?? 'NA';
                if (searchTerm)
                    return <Highlighter searchWords={[searchTerm]} textToHighlight={deviceType} highlightStyle={{
                        backgroundColor: '#FFC733',
                        padding: 0
                    }} />;
                else
                    return deviceType;
            },
            sorter: (a, b) => (a.metadata?.deviceId ?? 'NA').localeCompare(b.metadata?.deviceId ?? 'NA')
        },
        {
            title: 'Period',
            dataIndex: 'period',
            key: 'period',
            render: (__unused__value, record) => {
                const { startDate, endDate } = JSON.parse(record.description);
                return <>{dayjs(startDate).format('YYYY-MM-DD')}&nbsp;&nbsp;<SwapRightOutlined />&nbsp;&nbsp;{dayjs(endDate).format('YYYY-MM-DD')}</>;
            }
        },
        {
            title: 'Uploaded',
            dataIndex: 'uploadTime',
            key: 'uploadTime',
            render: (value) => dayjs(parseInt(value)).format('YYYY-MM-DD'),
            sorter: (a, b) => parseInt(a.uploadTime) - parseInt(b.uploadTime)
        },
        {
            title: 'Uploaded By',
            dataIndex: 'uploadBy',
            key: 'uploadBy',
            render: (__unused__value, record) => {
                const uploadedBy = record.uploadedBy === undefined ? 'NA' : userIdNameMapping[record.uploadedBy];
                if (searchTerm)
                    return <Highlighter searchWords={[searchTerm]} textToHighlight={uploadedBy} highlightStyle={{
                        backgroundColor: '#FFC733',
                        padding: 0
                    }} />;
                else
                    return uploadedBy;
            },
            sorter: (a, b) => userIdNameMapping[a.uploadedBy].localeCompare(userIdNameMapping[b.uploadedBy])
        },
        {
            title: 'Size',
            dataIndex: 'fileSize',
            render: (size) => formatBytes(size),
            width: '8rem',
            key: 'size'
        },
        {
            render: (__unused__value, record) => {
                const ext = record.fileName.substr(record.fileName.lastIndexOf('.')).toLowerCase();
                const file = JSON.parse(record.description);
                const startDate = dayjs(file.startDate).format('YYYYMMDD');
                const endDate = dayjs(file.endDate).format('YYYYMMDD');
                return <Button icon={<CloudDownloadOutlined />} download={`${file.participantId}-${file.deviceId}-${startDate}-${endDate}.${ext}`} href={`/file/${record.id}`}>
                    Download
                </Button>;
            },
            width: '10rem',
            key: 'download'
        }]
        .concat(!loadingWhoAmI && dataWhoAmI?.whoAmI?.type === userTypes.ADMIN ? [
            {
                render: (__unused__value, record) => (
                    <Button icon={<DeleteOutlined />} loading={isDeleting[record.id]} danger onClick={() => deletionHandler(record.id)}>
                        Delete
                    </Button>
                ),
                width: '8rem',
                key: 'delete'
            }
        ] : [])
        .concat([
            {
                render: (__unused__value, record) => (
                    <Tooltip title={record.hash} placement='bottomRight' >
                        <Button type='link' icon={<NumberOutlined />} loading={isDeleting[record.id]}></Button>
                    </Tooltip>
                ),
                width: '8rem',
                key: 'delete'
            }
        ]);

    const fileNameColumns = [
        {
            title: 'File Name',
            dataIndex: 'fileName',
            key: 'fileName',
            render: (__unused__value, record) => {
                return record.fileName;
            },
            sorter: (a, b) => parseInt(a.uploadTime) - parseInt(b.uploadTime)
        },
        {
            title: 'Updated',
            dataIndex: 'uploadTime',
            key: 'uploadTime',
            render: (value) => dayjs(parseInt(value)).format('YYYY-MM-DD'),
            sorter: (a, b) => parseInt(a.uploadTime) - parseInt(b.uploadTime)
        },
        {
            title: 'Uploaded By',
            dataIndex: 'uploadBy',
            key: 'uploadBy',
            render: (__unused__value, record) => {
                const uploadedBy = record.uploadedBy === undefined ? 'NA' : userIdNameMapping[record.uploadedBy];
                if (searchTerm)
                    return <Highlighter searchWords={[searchTerm]} textToHighlight={uploadedBy} highlightStyle={{
                        backgroundColor: '#FFC733',
                        padding: 0
                    }} />;
                else
                    return uploadedBy;
            },
            sorter: (a, b) => userIdNameMapping[a.uploadedBy].localeCompare(userIdNameMapping[b.uploadedBy])
        },
        {
            title: 'Size',
            dataIndex: 'fileSize',
            render: (size) => formatBytes(size),
            width: '8rem',
            key: 'size'
        },
        {
            render: (__unused__value, record) => {
                const ext = record.fileName.substr(record.fileName.lastIndexOf('.')).toLowerCase();
                const file = JSON.parse(record.description);
                const startDate = dayjs(file.startDate).format('YYYYMMDD');
                const endDate = dayjs(file.endDate).format('YYYYMMDD');
                return <Button icon={<CloudDownloadOutlined />} download={`${file.participantId}-${file.deviceId}-${startDate}-${endDate}.${ext}`} href={`/file/${record.id}`}>
                    Download
                </Button>;
            },
            width: '10rem',
            key: 'download'
        }]
        .concat(!loadingWhoAmI && dataWhoAmI?.whoAmI?.type === userTypes.ADMIN ? [
            {
                render: (__unused__value, record) => (
                    <Button icon={<DeleteOutlined />} loading={isDeleting[record.id]} danger onClick={() => deletionHandler(record.id)}>
                        Delete
                    </Button>
                ),
                width: '8rem',
                key: 'delete'
            }
        ] : [])
        .concat([
            {
                render: (__unused__value, record) => (
                    <Tooltip title={record.hash} placement='bottomRight' >
                        <Button type='link' icon={<NumberOutlined />} loading={isDeleting[record.id]}></Button>
                    </Tooltip>
                ),
                width: '8rem',
                key: 'delete'
            }
        ]);
    return <Table
        rowKey={(rec) => rec.id}
        pagination={
            {
                defaultPageSize: 50,
                showSizeChanger: true,
                pageSizeOptions: ['20', '50', '100', '200'],
                defaultCurrent: 1,
                showQuickJumper: true
            }
        }
        columns={isStudyLevel ? fileNameColumns : fileDetailsColumns}
        dataSource={files.sort((a, b) => { return parseFloat(b.uploadTime) - parseFloat(a.uploadTime); })}
        size='small' />;

};

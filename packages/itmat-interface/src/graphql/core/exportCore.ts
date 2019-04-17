import mongodb from 'mongodb';
import { db } from '../../database/database';
import { permissions } from 'itmat-utils';
import { ApolloError } from 'apollo-server-core';
import { IProject, IStudy, IRole } from 'itmat-utils/dist/models/study';
import { IJob, IJobEntry, jobTypes } from 'itmat-utils/dist/models/job';
import { errorCodes } from '../errors';
import uuidv4 from 'uuid/v4';
import { IUser, userTypes } from 'itmat-utils/dist/models/user';
import { fieldCore, FieldCore } from './fieldCore';
import { PermissionCore } from './permissionCore';
import { request } from 'https';

export class ExportCore {
    constructor(){}

    async createExportJob(studyId: string, requester: IUser, projectId?: string): Promise<IJobEntry<undefined>> {

        const exportjob: IJobEntry<undefined> = {
            jobType: 'EXPORT',
            id: uuidv4(),
            projectId,
            studyId,
            requester: requester.id,
            receivedFiles: [],
            status: 'WAITING',
            error: null,
            cancelled: false
        };
        const result = await db.collections!.jobs_collection.insertOne(exportjob);
        if (result.result.ok === 1) {
            return exportjob;
        } else {
            throw new ApolloError('Cannot create export job', errorCodes.DATABASE_ERROR);
        }
    }

}

export const exportCore = Object.freeze(new ExportCore());
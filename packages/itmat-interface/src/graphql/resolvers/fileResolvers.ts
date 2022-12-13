import { GraphQLError } from 'graphql';
import { IFile, studyType, IOrganisation, IUser, task_required_permissions } from '@itmat-broker/itmat-types';
import { Logger } from '@itmat-broker/itmat-commons';
import { v4 as uuid } from 'uuid';
import { FileUpload } from 'graphql-upload-minimal';
import { db } from '../../database/database';
import { objStore } from '../../objStore/objStore';
import { permissionCore } from '../core/permissionCore';
import { errorCodes } from '../errors';
import { IGenericResponse, makeGenericReponse } from '../responses';
import crypto from 'crypto';
import { validate } from '@ideafast/idgen';
import { deviceTypes, fileSizeLimit } from '../../utils/definition';

export const fileResolvers = {
    Query: {
    },
    Mutation: {
        uploadFile: async (__unused__parent: Record<string, unknown>, args: { fileLength?: bigint, studyId: string, file: Promise<FileUpload>, description: string, hash?: string }, context: any): Promise<IFile> => {

            const requester: IUser = context.req.user;

            const hasPermission = await permissionCore.userHasTheNeccessaryPermission(
                task_required_permissions.manage_study_data,
                requester,
                args.studyId
            );
            if (!hasPermission) { throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR); }

            const study = await db.collections!.studies_collection.findOne({ id: args.studyId });
            if (!study) {
                throw new GraphQLError('Study does not exist.');
            }

            const file = await args.file;
            const fileNameParts = file.filename.split('.');

            // obtain sitesIDMarker from db
            const sitesIDMarkers = (await db.collections!.organisations_collection.find<IOrganisation>({ deleted: null }).toArray()).reduce<any>((acc, curr) => {
                if (curr.metadata?.siteIDMarker) {
                    acc[curr.metadata.siteIDMarker] = curr.shortname;
                }
                return acc;
            }, {});

            return new Promise<IFile>((resolve, reject) => {
                try {

                    const fileEntry: Partial<IFile> = {
                        id: uuid(),
                        fileName: file.filename,
                        studyId: args.studyId,
                        description: args.description,
                        uploadTime: `${Date.now()}`,
                        uploadedBy: requester.id,
                        deleted: null
                    };
                    // description varies: SENSOR, CLINICAL (only participantId), ANY (No check)
                    // check filename and description is valid and matches each other
                    const parsedDescription = JSON.parse(args.description);
                    if (!study.type || study.type === studyType.SENSOR || study.type === studyType.CLINICAL) {
                        const matcher = /(.{1})(.{6})-(.{3})(.{6})-(\d{8})-(\d{8})\.(.*)/;
                        if (!matcher.test(file.filename)) {
                            let startDate;
                            let endDate;
                            try {
                                startDate = parseInt(parsedDescription.startDate);
                                endDate = parseInt(parsedDescription.endDate);
                                if (
                                    !Object.keys(sitesIDMarkers).includes(parsedDescription.participantId?.substr(0, 1)?.toUpperCase()) ||
                                    !Object.keys(deviceTypes).includes(parsedDescription.deviceId?.substr(0, 3)?.toUpperCase()) ||
                                    !validate(parsedDescription.participantId?.substr(1) ?? '') ||
                                    !validate(parsedDescription.deviceId.substr(3) ?? '') ||
                                    !startDate || !endDate ||
                                    (new Date(endDate).setHours(0, 0, 0, 0).valueOf()) > (new Date().setHours(0, 0, 0, 0).valueOf())
                                ) {
                                    reject(new GraphQLError('File description is invalid', { extensions: { code: errorCodes.CLIENT_MALFORMED_INPUT } }));
                                    return;
                                }
                            } catch (e) {
                                reject(new GraphQLError('Missing file description', { extensions: { code: errorCodes.CLIENT_MALFORMED_INPUT } }));
                                return;
                            }

                            const typedStartDate = new Date(startDate);
                            const formattedStartDate = typedStartDate.getFullYear() + `${typedStartDate.getMonth() + 1}`.padStart(2, '0') + `${typedStartDate.getDate()}`.padStart(2, '0');
                            const typedEndDate = new Date(startDate);
                            const formattedEndDate = typedEndDate.getFullYear() + `${typedEndDate.getMonth() + 1}`.padStart(2, '0') + `${typedEndDate.getDate()}`.padStart(2, '0');
                            fileEntry.fileName = `${parsedDescription.participantId.toUpperCase()}-${parsedDescription.deviceId.toUpperCase()}-${formattedStartDate}-${formattedEndDate}.${fileNameParts[fileNameParts.length - 1]}`;
                        }
                    }

                    if (args.fileLength !== undefined && args.fileLength > fileSizeLimit) {
                        reject(new GraphQLError('File should not be larger than 8GB', { extensions: { code: errorCodes.CLIENT_MALFORMED_INPUT } }));
                        return;
                    }

                    const stream = file.createReadStream();
                    const fileUri = uuid();
                    const hash = crypto.createHash('sha256');
                    let readBytes = 0;

                    /* if the client cancelled the request mid-stream it will throw an error */
                    stream.on('error', (e) => {
                        reject(new GraphQLError('Upload resolver file stream failure', { extensions: { code: errorCodes.FILE_STREAM_ERROR, error: e } }));
                        return;
                    });

                    stream.on('data', (chunk) => {
                        readBytes += chunk.length;
                        if (readBytes > fileSizeLimit) {
                            stream.destroy();
                            reject(new GraphQLError('File should not be larger than 8GB', { extensions: { code: errorCodes.CLIENT_MALFORMED_INPUT } }));
                            return;
                        }
                        hash.update(chunk);
                    });

                    stream.on('end', async () => {

                        // hash is optional, but should be correct if provided
                        const hashString = hash.digest('hex');
                        if (args.hash && args.hash !== hashString) {
                            reject(new GraphQLError('File hash not match', { extensions: { code: errorCodes.CLIENT_MALFORMED_INPUT } }));
                            return;
                        }

                        // check if readbytes equal to filelength in parameters
                        if (args.fileLength !== undefined && args.fileLength.toString() !== readBytes.toString()) {
                            reject(new GraphQLError('File size mismatch', { extensions: { code: errorCodes.CLIENT_MALFORMED_INPUT } }));
                            return;
                        }

                        fileEntry.fileSize = readBytes.toString();
                        fileEntry.uri = fileUri;
                        fileEntry.hash = hashString;

                        const insertResult = await db.collections!.files_collection.insertOne(fileEntry as IFile);
                        if (insertResult.acknowledged) {
                            resolve(fileEntry as IFile);
                        } else {
                            throw new GraphQLError(errorCodes.DATABASE_ERROR);
                        }
                    });

                    objStore.uploadFile(stream, args.studyId, fileUri);

                } catch (e) {
                    Logger.error(e);
                    Logger.error(errorCodes.FILE_STREAM_ERROR);
                }
            });
        },
        deleteFile: async (__unused__parent: Record<string, unknown>, args: { fileId: string }, context: any): Promise<IGenericResponse> => {
            const requester: IUser = context.req.user;

            const file = await db.collections!.files_collection.findOne({ deleted: null, id: args.fileId });

            if (!file) {
                throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
            }
            const hasPermission = await permissionCore.userHasTheNeccessaryPermission(
                task_required_permissions.manage_study_data,
                requester,
                file.studyId
            );
            if (!hasPermission) { throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR); }

            const updateResult = await db.collections!.files_collection.updateOne({ deleted: null, id: args.fileId }, { $set: { deleted: new Date().valueOf() } });
            if (updateResult.modifiedCount === 1 || updateResult.upsertedCount === 1) {
                return makeGenericReponse();
            } else {
                throw new GraphQLError(errorCodes.DATABASE_ERROR);
            }
        }
    },
    Subscription: {}
};

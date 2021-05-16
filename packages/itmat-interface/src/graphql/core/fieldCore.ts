import { IFieldEntry, enumValueType } from 'itmat-commons';
import { db } from '../../database/database';
export class FieldCore {
    public async getFieldsOfStudy(studyId: string, detailed: boolean, getOnlyTheseFields?: string[]): Promise<IFieldEntry[]> {
        /* ASSUMING projectId and studyId match*/
        /* if detailed=false, only returns the fieldid in an array */
        /* constructing queryObj; if projectId is provided then only those in the approved fields are returned */
        let queryObj: any = { studyId };
        if (getOnlyTheseFields) {  // if both study id and project id are provided then just make sure they belong to each other
            queryObj = { studyId, fieldId: { $in: getOnlyTheseFields } };
        }

        const aggregatePipeline: any = [
            { $match: queryObj }
        ];
        /* if detailed=false, only returns the fieldid in an array */
        if (detailed === false) {
            aggregatePipeline.push({ $group: { _id: null, array: { $addToSet: '$fieldId' } } });
        }

        const cursor = db.collections!.field_dictionary_collection.aggregate(aggregatePipeline);
        return cursor.toArray();
    }

}


export function validateAndGenerateFieldEntry(fieldEntry: any) {
    // duplicates with existing fields are checked by caller function
    const error: string[] = [];
    const complusoryField = [
        'fieldId',
        'fieldName',
        'dataType'
    ];

    // check missing field
    for (const key of complusoryField) {
        if (fieldEntry[key] === undefined && fieldEntry[key] === null) {
            error.push(`${key} should not be empty.`);
        }
    }

    // data types
    if (!Object.values(enumValueType).includes(fieldEntry.dataType)) {
        error.push(`Data type shouldn't be ${fieldEntry.dataType}: use 'int' for integer, 'dec' for decimal, 'str' for string, 'bool' for boolean, 'date' for datetime, 'file' for FILE, 'json' for json.`);
    }

    // check possiblevalues to be not-empty if datatype is categorical
    if (fieldEntry.dataType === enumValueType.CATEGORICAL) {
        if (fieldEntry.possibleValues !== undefined) {
            if (fieldEntry.possibleValues.length === 0) {
                error.push(`${fieldEntry.fieldId}-${fieldEntry.fieldName}: possible values can't be empty if data type is categorical.`);
            }
        } else {
            error.push(`${fieldEntry.fieldId}-${fieldEntry.fieldName}: possible values can't be empty if data type is categorical.`);
        }
    }

    const newField: any = {
        fieldId: fieldEntry.fieldId,
        fieldName: fieldEntry.fieldName,
        tableName: fieldEntry.tableName,
        dataType: fieldEntry.dataType,
        possibleValues: fieldEntry.possibleValues,
        unit: fieldEntry.unit,
        comments: fieldEntry.comments,
    };

    return {fieldEntry: newField, error: error};
}

export const fieldCore = Object.freeze(new FieldCore());

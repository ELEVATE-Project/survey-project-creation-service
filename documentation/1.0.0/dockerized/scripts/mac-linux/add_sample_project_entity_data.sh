#!/bin/bash

clean_object_id() {
    local object_id="$1"

    # Use parameter expansion to remove unwanted characters
    cleaned_id="${object_id//ObjectId(/}"
    cleaned_id="${cleaned_id//)/}"
    cleaned_id="${cleaned_id//\'/}"

    echo "$cleaned_id"
}


MONGO_HOST=project_mongo_1
MONGO_PORT=27017

# Entity database details
ENTITY_SERVICE_DB_NAME="elevate-entity"
ENTITY_TYPE_COLLECTION="entityTypes"
ENTITIES_COLLECTION="entities"

ENTITY_TYPE_DOCUMENT=$(cat <<EOF
{
    "name": "state",
    "toBeMappedToParentEntities": true,
    "immediateChildrenEntityType": ["district"],
    "isDeleted": false
}
EOF
)

echo "EntityType data being added to $ENTITY_TYPE_COLLECTION collection in $ENTITY_SERVICE_DB_NAME database...."

ENTITY_TYPE_ID=$(docker exec -it project_mongo_1 mongo --host "$MONGO_HOST" --port "$MONGO_PORT" --quiet --eval "
    var doc = $ENTITY_TYPE_DOCUMENT
    var result = db.getSiblingDB('$ENTITY_SERVICE_DB_NAME').$ENTITY_TYPE_COLLECTION.insertOne(doc);
    if (result.insertedId) {
        print(result.insertedId);
    } else {
        throw new Error('Insert failed');
    }
")

ENTITY_TYPE_ID=$(clean_object_id "$ENTITY_TYPE_ID")
echo "EntityType ID: $ENTITY_TYPE_ID"

ENTITY_TYPE_DISTRICT_DOCUMENT=$(cat <<EOF
{
    "name" : "district",
    "toBeMappedToParentEntities" : true,
    "immediateChildrenEntityType" : [ 
        "block"
    ],
    "isDeleted" : false
}
EOF
)

echo "EntityType data being added to $ENTITY_TYPE_COLLECTION collection in $ENTITY_SERVICE_DB_NAME database...."

ENTITY_TYPE_DISTRICT_DOCUMENT_ID=$(docker exec -it project_mongo_1 mongo --host "$MONGO_HOST" --port "$MONGO_PORT" --quiet --eval "
    var doc = $ENTITY_TYPE_DISTRICT_DOCUMENT
    var result = db.getSiblingDB('$ENTITY_SERVICE_DB_NAME').$ENTITY_TYPE_COLLECTION.insertOne(doc);
    if (result.insertedId) {
        print(result.insertedId);
    } else {
        throw new Error('Insert failed');
    }
")

ENTITY_TYPE_DISTRICT_DOCUMENT_ID=$(clean_object_id "$ENTITY_TYPE_DISTRICT_DOCUMENT_ID")
echo "EntityType ID for district doc: $ENTITY_TYPE_DISTRICT_DOCUMENT_ID"

ENTITIES_DOCUMENT=$(cat <<EOF
{
    "name" : "Karnataka",
    "entityType" : "state",
    "entityTypeId" : $ENTITY_TYPE_ID,
    "userId" : "1",
    "metaInformation" : {
        "externalId" : "KR001",
        "name" : "Karnataka"
    },
    "childHierarchyPath": []
}
EOF
)

echo "Entity data being added to $ENTITIES_COLLECTION collection in $ENTITY_SERVICE_DB_NAME database...."

ENTITY_ID=$(docker exec -it project_mongo_1 mongo --host "$MONGO_HOST" --port "$MONGO_PORT" --quiet --eval "
    var doc = $ENTITIES_DOCUMENT
    var result = db.getSiblingDB('$ENTITY_SERVICE_DB_NAME').$ENTITIES_COLLECTION.insertOne(doc);
    if (result.insertedId) {
        print(result.insertedId);
    } else {
        throw new Error('Insert failed');
    }
")

ENTITY_ID=$(clean_object_id "$ENTITY_ID")

echo "Entity ID: $ENTITY_ID"


ENTITIES_DOCUMENT_DISTRICT_TYPE=$(cat <<EOF
{
    "name" : "Bangalore",
    "entityType" : "district",
    "entityTypeId" : $ENTITY_TYPE_DISTRICT_DOCUMENT_ID,
    "userId" : "1",
    "metaInformation" : {
        "externalId" : "BN001",
        "name" : "Bangalore"
    },
    "childHierarchyPath" : [],
    "groups" : {}
}
EOF
)

echo "Entity data being added to $ENTITIES_COLLECTION collection in $ENTITY_SERVICE_DB_NAME database...."

ENTITY_ID_DISTRICT=$(docker exec -it project_mongo_1 mongo --host "$MONGO_HOST" --port "$MONGO_PORT" --quiet --eval "
    var doc = $ENTITIES_DOCUMENT_DISTRICT_TYPE
    var result = db.getSiblingDB('$ENTITY_SERVICE_DB_NAME').$ENTITIES_COLLECTION.insertOne(doc);
    if (result.insertedId) {
        print(result.insertedId);
    } else {
        throw new Error('Insert failed');
    }
")

ENTITY_ID_DISTRICT=$(clean_object_id "$ENTITY_ID_DISTRICT")
echo "Entity ID bangalore: $ENTITY_ID_DISTRICT"

echo "ObjectId($ENTITY_ID)"
#updating groups
docker exec project_mongo_1 mongo --host "$MONGO_HOST" --port "$MONGO_PORT" --quiet --eval "
    var updateResult = db.getSiblingDB('$ENTITY_SERVICE_DB_NAME').$ENTITIES_COLLECTION.updateOne(
        {_id: ObjectId($ENTITY_ID)},
        { 
            \$set: { 
                'groups.district': [ObjectId($ENTITY_ID_DISTRICT)] 
            }
        }
    );
    if (updateResult.matchedCount > 0) {
        print('Document updated successfully');
    } else {
        throw new Error('Update failed');
    }"




# Project database details
PROJECT_DB_NAME="elevate-project"
PROJECT_CATEGORY_COLLECTION="projectCategories"

PROJECT_CATEGORY_DOCUMENT=$(cat <<EOF
[{
    "externalId" : "educationLeader",
    "name" : "Education Leader",
    "status" : "active"
},{
    "externalId" : "community",
    "name" : "Community",
    "status" : "active"
},{
    "externalId" : "teacher",
    "name" : "Teacher",
    "status" : "active"
}]
EOF
)

echo "Project category data being added to $PROJECT_CATEGORY_COLLECTION collection in $PROJECT_DB_NAME database...."

PROJECT_CATEGORY_ID=$(docker exec -it project_mongo_1 mongo --host "$MONGO_HOST" --port "$MONGO_PORT" --quiet --eval "
    var doc = $PROJECT_CATEGORY_DOCUMENT;
    var result = db.getSiblingDB('$PROJECT_DB_NAME').$PROJECT_CATEGORY_COLLECTION.insertMany(doc);
    if (result.insertedIds && Object.keys(result.insertedIds).length > 0) {
        print(result.insertedIds);
    } else {
        throw new Error('Insert failed');
    }
")

# Convert the string into an array
IFS=',' read -r -a PROJECT_CATEGORY_ID_ARRAY <<< "$PROJECT_CATEGORY_ID"

# Clean each ObjectId in the array and store the cleaned IDs back into the same array
for i in "${!PROJECT_CATEGORY_ID_ARRAY[@]}"; do
    PROJECT_CATEGORY_ID_ARRAY[i]=$(clean_object_id "${PROJECT_CATEGORY_ID_ARRAY[i]}")
done

PROJECT_CATEGORY_ID=$(clean_object_id "${PROJECT_CATEGORY_ID_ARRAY[0]}")
echo "Project Category ID: $PROJECT_CATEGORY_ID"

PROGRAMS_COLLECTION="programs"

PROGRAMS_DOCUMENT=$(cat <<EOF
{
    "resourceType": ["program"],
    "language": ["English"],
    "keywords": [],
    "concepts": [],
    "components": [],
    "isAPrivateProgram": false,
    "isDeleted": false,
    "requestForPIIConsent": true,
    "rootOrganisations": [],
    "createdFor": [],
    "deleted": false,
    "status": "active",
    "owner": "1",
    "createdBy": "1",
    "updatedBy": "1",
    "externalId": "PG01",
    "name": "School Hygiene Improvement Initiative",
    "description": "The School Hygiene Improvement Initiative is dedicated to ensuring clean, safe, and healthy environments in schools. This program focuses on promoting hygiene best practices among students, staff, and administrators to prevent the spread of illnesses, enhance student well-being, and foster an atmosphere conducive to learning. Through regular cleanliness audits, sanitation drives, and hygiene awareness campaigns, the program aims to improve the condition of school facilities, particularly washrooms, classrooms, and common areas. Special emphasis is placed on educating students about personal hygiene, proper handwashing techniques, and maintaining a clean environment to create a culture of responsibility and care within the school community.",
    "startDate": "2024-04-16T00:00:00.000Z",
    "endDate": "2025-12-16T18:29:59.000Z",
    "scope": {
        "state": [$ENTITY_ID],
        "roles": ["district_education_officer"],
        "entityType": "state"
    }
}
EOF
)

echo "Program data being added to $PROGRAMS_COLLECTION collection in $PROJECT_DB_NAME database...."

# Insert PROGRAM_ID using mongosh
PROGRAM_ID=$(docker exec -it project_mongo_1 mongo --host "$MONGO_HOST" --port "$MONGO_PORT" --quiet --eval "
    var doc = $PROGRAMS_DOCUMENT;
    var result = db.getSiblingDB('$PROJECT_DB_NAME').$PROGRAMS_COLLECTION.insertOne(doc);
    if (result.insertedId) {
        print(result.insertedId);
    } else {
        throw new Error('Insert failed');
    }
")


PROGRAM_ID=$(clean_object_id "$PROGRAM_ID")
echo "Program ID: $PROGRAM_ID"

PROJECT_TEMPLATES_COLLECTION="projectTemplates"

PROJECT_TEMPLATES_DOCUMENT=$(cat <<EOF
[{
    "description": "The School Hygiene Improvement Initiative is dedicated to ensuring clean, safe, and healthy environments in schools...",
    "concepts": [""],
    "keywords": [""],
    "isDeleted": false,
    "recommendedFor": [],
    "tasks": [],
    "learningResources": [{
        "name" : "Washroom management learning resource",
        "link": "https://youtu.be/libKVRa01L8?feature=shared",
        "app": "projectService",
        "id": "libKVRa01L8?feature=shared"
    }],
    "isReusable": false,
    "title": "Washroom Hygiene",
    "externalId": "WASH-HYGIENE",
    "categories": [{
        "_id": $PROJECT_CATEGORY_ID,
        "externalId": "educationLeader",
        "name": "Education Leader"
    }],
    "status": "published",
    "programId": $PROGRAM_ID
},
{   "description": "A robust library management program fosters a culture of reading and learning, empowering students to explore diverse resources...",
    "concepts": [""],
    "keywords": [""],
    "isDeleted": false,
    "recommendedFor": [],
    "tasks": [],
    "learningResources": [{
        "name" : "Library Management learning resource",
        "link": "https://youtu.be/libKVRa01L8?feature=shared",
        "app": "projectService",
        "id": "libKVRa01L8?feature=shared"
    }],
    "isReusable": false,
    "title": "Library Management",
    "externalId": "LIB-MANAGEMENT",
    "categories": [{
        "_id": $PROJECT_CATEGORY_ID,
        "externalId": "educationLeader",
        "name": "Education Leader"
    }],
    "status": "published",
    "programId": $PROGRAM_ID
},
{   "description": "Ensuring access to clean and safe water in schools is vital for fostering a healthy learning environment, enhancing student well-being, and promoting overall academic success.",
    "concepts": [""],
    "keywords": [""],
    "isDeleted": false,
    "recommendedFor": [],
    "tasks": [],
    "learningResources": [{
        "name" : "Drinking water management learning resource",
        "link": "https://youtu.be/libKVRa01L8?feature=shared",
        "app": "projectService",
        "id": "libKVRa01L8?feature=shared"
    }],
    "isReusable": false,
    "title": "Drinking Water Availability",
    "externalId": "DRINKING-WATER-AVAILABILITY",
    "categories": [{
        "_id": $PROJECT_CATEGORY_ID,
        "externalId": "educationLeader",
        "name": "Education Leader"
    }],
    "status": "published",
    "programId": $PROGRAM_ID
},
{   "description": "Providing access to quality sports equipment fosters teamwork, promotes physical fitness, and nurtures the spirit of competition, ultimately contributing to the holistic development...",
    "concepts": [""],
    "keywords": [""],
    "isDeleted": false,
    "recommendedFor": [],
    "tasks": [],
    "learningResources": [{
        "name" : "Sports management learning resource",
        "link": "https://youtu.be/libKVRa01L8?feature=shared",
        "app": "projectService",
        "id": "libKVRa01L8?feature=shared"
    }],
    "isReusable": false,
    "title": "Sports Management",
    "externalId": "SPORTS-MANAGEMENT",
    "categories": [{
        "_id": $PROJECT_CATEGORY_ID,
        "externalId": "educationLeader",
        "name": "Education Leader"
    }],
    "status": "published",
    "programId": $PROGRAM_ID
}]
EOF
)

echo "Project template data being added to $PROJECT_TEMPLATES_COLLECTION collection in $PROJECT_DB_NAME database...."

# Insert PROJECT_TEMPLATE_ID using docker exec
PROJECT_TEMPLATE_ID=$(docker exec -it project_mongo_1 mongo --host "$MONGO_HOST" --port "$MONGO_PORT" --quiet --eval "
    var doc = $PROJECT_TEMPLATES_DOCUMENT;
    var result = db.getSiblingDB('$PROJECT_DB_NAME').$PROJECT_TEMPLATES_COLLECTION.insertMany(doc);
    if (result.insertedIds && Object.keys(result.insertedIds).length > 0) {
        print(result.insertedIds);
    } else {
        throw new Error('Insert failed');
    }
")

# Convert the string into an array
IFS=',' read -r -a PROJECT_TEMPLATE_ID_ARRAY <<< "$PROJECT_TEMPLATE_ID"

# Clean each ObjectId in the array and store the cleaned IDs back into the same array
for i in "${!PROJECT_TEMPLATE_ID_ARRAY[@]}"; do
    PROJECT_TEMPLATE_ID_ARRAY[i]=$(clean_object_id "${PROJECT_TEMPLATE_ID_ARRAY[i]}")
done

# Now you can access the cleaned IDs
echo "Project Template IDs:"
for id in "${PROJECT_TEMPLATE_ID_ARRAY[@]}"; do
    echo "$id"
done

# Convert the multiline JSON to a single line
for ((i = 0; i < ${#PROJECT_TEMPLATE_ID_ARRAY[@]}; i++)); do
  eval "PROJECT_TEMPLATE_ID_$((i+1))=\$(clean_object_id \"\${PROJECT_TEMPLATE_ID_ARRAY[$i]}\")"
done

PROJECT_TEMPLATE_TASKS_COLLECTION="projectTemplateTasks"
PROJECT_TEMPLATE_TASKS_DOCUMENTS=$(cat <<EOF
[
{
    "isDeleted" : false,
    "isDeletable" : false,
    "taskSequence" : [

    ],
    "children" : [

    ],
    "visibleIf" : [

    ],
    "hasSubTasks" : false,
    "learningResources" : [
        {
            "name" : "Washroom management learning resource",
            "link" : "https://youtube.com/watch?v=XExMb0XBhw4",
            "app" : "projectService",
            "id" : "watch?v=XExMb0XBhw4"
        }
    ],
    "deleted" : false,
    "type" : "content",
    "projectTemplateId": ObjectId($PROJECT_TEMPLATE_ID_1),
    "projectTemplateExternalId" : "WASH-HYGIENE",
    "name" : "Keep the washroom clean.",
    "externalId" : "Wash-Hyg-01",
    "description" : "",
    "sequenceNumber" : "1",
    "metaInformation" : {
        "hasAParentTask" : "NO",
        "parentTaskOperator" : "",
        "parentTaskValue" : "",
        "parentTaskId" : "",
        "startDate" : "30/08/2021",
        "endDate" : "30/08/2029",
        "minNoOfSubmissionsRequired" : ""
    },
    "__v" : NumberInt(0)
},
{
    "isDeleted" : false,
    "isDeletable" : false,
    "taskSequence" : [

    ],
    "children" : [

    ],
    "visibleIf" : [

    ],
    "hasSubTasks" : false,
    "learningResources" : [
        {
            "name" : "Library management learning resource",
            "link" : "https://youtube.com/watch?v=XExMb0XBhw4",
            "app" : "projectService",
            "id" : "watch?v=XExMb0XBhw4"
        }
    ],
    "deleted" : false,
    "type" : "content",
    "projectTemplateId": ObjectId($PROJECT_TEMPLATE_ID_2),
    "projectTemplateExternalId" : "LIB-MANAGEMENT",
    "name" : "Stack the books properly in the library.",
    "externalId" : "Lib-Mana-01",
    "description" : "",
    "sequenceNumber" : "1",
    "metaInformation" : {
        "hasAParentTask" : "NO",
        "parentTaskOperator" : "",
        "parentTaskValue" : "",
        "parentTaskId" : "",
        "startDate" : "30/08/2021",
        "endDate" : "30/08/2029",
        "minNoOfSubmissionsRequired" : ""
    },
    "__v" : NumberInt(0)
},
{
    "isDeleted" : false,
    "isDeletable" : false,
    "taskSequence" : [

    ],
    "children" : [

    ],
    "visibleIf" : [

    ],
    "hasSubTasks" : false,
    "learningResources" : [
        {
            "name" : "Drinking water management learning resource",
            "link" : "https://youtube.com/watch?v=XExMb0XBhw4",
            "app" : "projectService",
            "id" : "watch?v=XExMb0XBhw4"
        }
    ],
    "deleted" : false,
    "type" : "content",
    "projectTemplateId": ObjectId($PROJECT_TEMPLATE_ID_3),
    "projectTemplateExternalId" : "DRINKING-WATER-AVAILABILITY",
    "name" : "Keep the drinking water vessels clean.",
    "externalId" : "Drink-Wat-01",
    "description" : "",
    "sequenceNumber" : "1",
    "metaInformation" : {
        "hasAParentTask" : "NO",
        "parentTaskOperator" : "",
        "parentTaskValue" : "",
        "parentTaskId" : "",
        "startDate" : "30/08/2021",
        "endDate" : "30/08/2029",
        "minNoOfSubmissionsRequired" : ""
    },
    "__v" : NumberInt(0)

},
{
    "isDeleted" : false,
    "isDeletable" : false,
    "taskSequence" : [

    ],
    "children" : [

    ],
    "visibleIf" : [

    ],
    "hasSubTasks" : false,
    "learningResources" : [
        {
            "name" : "Sports management learning resource",
            "link" : "https://youtube.com/watch?v=XExMb0XBhw4",
            "app" : "projectService",
            "id" : "watch?v=XExMb0XBhw4"
        }
    ],
    "deleted" : false,
    "type" : "content",
    "projectTemplateId": ObjectId($PROJECT_TEMPLATE_ID_4),
    "projectTemplateExternalId" : "SPORTS-MANAGEMENT",
    "name" : "Stack the sport equipments in correct order.",
    "externalId" : "Spor-Mana-01",
    "description" : "",
    "sequenceNumber" : "1",
    "metaInformation" : {
        "hasAParentTask" : "NO",
        "parentTaskOperator" : "",
        "parentTaskValue" : "",
        "parentTaskId" : "",
        "startDate" : "30/08/2021",
        "endDate" : "30/08/2029",
        "minNoOfSubmissionsRequired" : ""
    },
    "__v" : NumberInt(0)

}]
EOF
)

echo "Project template tasks data being added to $PROJECT_TEMPLATE_TASKS_COLLECTION collection in $PROJECT_DB_NAME database...."

# Insert PROJECT_TEMPLATE_ID using docker exec
PROJECT_TEMPLATE_TASKS_ID=$(docker exec -it project_mongo_1 mongo --host "$MONGO_HOST" --port "$MONGO_PORT" --quiet --eval "
    var doc = $PROJECT_TEMPLATE_TASKS_DOCUMENTS;
    var result = db.getSiblingDB('$PROJECT_DB_NAME').$PROJECT_TEMPLATE_TASKS_COLLECTION.insertMany(doc);
    if (result.insertedIds && Object.keys(result.insertedIds).length > 0) {
        print(result.insertedIds);
    } else {
        throw new Error('Insert failed');
    }
")

# Convert the string into an array
IFS=',' read -r -a PROJECT_TEMPLATE_TASKS_ID_ARRAY <<< "$PROJECT_TEMPLATE_TASKS_ID"

# Clean each ObjectId in the array and store the cleaned IDs back into the same array
for i in "${!PROJECT_TEMPLATE_TASKS_ID_ARRAY[@]}"; do
    PROJECT_TEMPLATE_TASKS_ID_ARRAY[i]=$(clean_object_id "${PROJECT_TEMPLATE_TASKS_ID_ARRAY[i]}")
done

# Now you can access the cleaned IDs
echo "Project Template Tasks IDs:"
for id in "${PROJECT_TEMPLATE_TASKS_ID_ARRAY[@]}"; do
    echo "$id"
done

# Convert the multiline JSON to a single line
for ((i = 0; i < ${#PROJECT_TEMPLATE_TASKS_ID_ARRAY[@]}; i++)); do
  eval "PROJECT_TEMPLATE_TASK_ID_$((i+1))=\$(clean_object_id \"\${PROJECT_TEMPLATE_TASKS_ID_ARRAY[$i]}\")"
done


SOLUTIONS_COLLECTION="solutions"

SOLUTION_DOCUMENT=$(cat <<EOF
[{
    "resourceType": ["Improvement Project Solution"],
    "language": ["English"],
    "keywords": ["Improvement Project"],
    "entities": [$ENTITY_ID],
    "programId": $PROGRAM_ID,
    "name": "Washroom Hygiene",
    "description": "The School Hygiene Improvement Initiative is dedicated to ensuring clean, safe, and healthy environments in schools...",
    "programExternalId": "PG01",
    "scope": {
        "state": [$ENTITY_ID],
        "roles": ["state_education_officer"],
        "entityType": "state"
    },
    "projectTemplateId": ObjectId($PROJECT_TEMPLATE_ID_1),
    "startDate" : ISODate("2021-08-30T00:00:00.000Z"),
    "endDate" : ISODate("2029-08-30T00:00:00.000Z"),
    "isDeleted" : false,
    "isAPrivateProgram" : false,
    "isReusable" : false,
    "status" : "active",
    "type" : "improvementProject"
},
{
    "resourceType": ["Improvement Project Solution"],
    "language": ["English"],
    "keywords": ["Improvement Project"],
    "entities": [$ENTITY_ID],
    "programId": $PROGRAM_ID,
    "name": "Library Management",
    "description": "A robust library management program fosters a culture of reading and learning, empowering students to explore diverse resources...",
    "programExternalId": "PG01",
    "scope": {
        "state": [$ENTITY_ID],
        "roles": ["state_education_officer"],
        "entityType": "state"
    },
    "projectTemplateId": ObjectId($PROJECT_TEMPLATE_ID_2),
    "startDate" : ISODate("2021-08-30T00:00:00.000Z"),
    "endDate" : ISODate("2029-08-30T00:00:00.000Z"),
    "isDeleted" : false,
    "isAPrivateProgram" : false,
    "isReusable" : false,
    "status" : "active",
    "type" : "improvementProject"
},
{
    "resourceType": ["Improvement Project Solution"],
    "language": ["English"],
    "keywords": ["Improvement Project"],
    "entities": [$ENTITY_ID],
    "programId": $PROGRAM_ID,
    "name": "Drinking Water Management",
    "description": "Ensuring access to clean and safe water in schools is vital for fostering a healthy learning environment, enhancing student well-being, and promoting overall academic success.",
    "programExternalId": "PG01",
    "scope": {
        "state": [$ENTITY_ID],
        "roles": ["state_education_officer"],
        "entityType": "state"
    },
    "projectTemplateId": ObjectId($PROJECT_TEMPLATE_ID_3),
    "startDate" : ISODate("2021-08-30T00:00:00.000Z"),
    "endDate" : ISODate("2029-08-30T00:00:00.000Z"),
    "isDeleted" : false,
    "isAPrivateProgram" : false,
    "isReusable" : false,
    "status" : "active",
    "type" : "improvementProject"
},
{
    "resourceType": ["Improvement Project Solution"],
    "language": ["English"],
    "keywords": ["Improvement Project"],
    "entities": [$ENTITY_ID],
    "programId": $PROGRAM_ID,
    "name": "Sports Management",
    "description": "Providing access to quality sports equipment fosters teamwork, promotes physical fitness, and nurtures the spirit of competition, ultimately contributing to the holistic development...",
    "programExternalId": "PG01",
    "scope": {
        "state": [$ENTITY_ID],
        "roles": ["district_education_officer"],
        "entityType": "state"
    },
    "projectTemplateId": ObjectId($PROJECT_TEMPLATE_ID_4),
    "startDate" : ISODate("2021-08-30T00:00:00.000Z"),
    "endDate" : ISODate("2029-08-30T00:00:00.000Z"),
    "isDeleted" : false,
    "isAPrivateProgram" : false,
    "isReusable" : false,
    "status" : "active",
    "type" : "improvementProject"
}]
EOF
)

# Convert the multiline JSON to a single line for MongoDB
# SOLUTION_DOCUMENT_SINGLE_LINE=$(echo "$SOLUTION_DOCUMENT" | tr -d '\n' | sed 's/"/\\"/g')

echo "Solution data being added to $SOLUTIONS_COLLECTION collection in $PROJECT_DB_NAME database...."

# Insert SOLUTION_ID using docker exec
SOLUTION_ID=$(docker exec -it project_mongo_1 mongo --host "$MONGO_HOST" --port "$MONGO_PORT" --quiet --eval "
    var doc = $SOLUTION_DOCUMENT;
    var result = db.getSiblingDB('$PROJECT_DB_NAME').$SOLUTIONS_COLLECTION.insertMany(doc);
    if (result.insertedIds && Object.keys(result.insertedIds).length > 0) {
        print(result.insertedIds);
    } else {
        throw new Error('Insert failed');
    }
")

# Convert the string into an array
IFS=',' read -r -a SOLUTION_ID_ARRAY <<< "$SOLUTION_ID"

# Clean each ObjectId in the array and store the cleaned IDs back into the same array
for i in "${!SOLUTION_ID_ARRAY[@]}"; do
    SOLUTION_ID_ARRAY[i]=$(clean_object_id "${SOLUTION_ID_ARRAY[i]}")
done

# Now you can access the cleaned IDs
echo "Solution IDs:"
for id in "${SOLUTION_ID_ARRAY[@]}"; do
    echo "$id"
done


# Updating project template with the solution ID and respective tasks
for ((i = 0; i < ${#SOLUTION_ID_ARRAY[@]}; i++)); do
  eval "SOLUTION_ID_$((i+1))=\$(clean_object_id \"\${SOLUTION_ID_ARRAY[$i]}\")"
done



docker exec project_mongo_1 mongo --host "$MONGO_HOST" --port "$MONGO_PORT" --quiet --eval "
    var updateResult = db.getSiblingDB('$PROJECT_DB_NAME').$PROJECT_TEMPLATES_COLLECTION.updateOne(
        {_id: ObjectId($PROJECT_TEMPLATE_ID_1)},
        { 
            \$set: { 
                'solutionId': ObjectId($SOLUTION_ID_1)
            },
            \$push: {
                'tasks': ObjectId($PROJECT_TEMPLATE_TASK_ID_1)
            }
        }
    );
    if (updateResult.matchedCount > 0) {
        print('Document updated successfully for ID: $PROJECT_TEMPLATE_ID_1');  // Output the specific ID
    } else {
        throw new Error('Update failed for ID: $PROJECT_TEMPLATE_ID_1');
    }"


docker exec project_mongo_1 mongo --host "$MONGO_HOST" --port "$MONGO_PORT" --quiet --eval "
    var updateResult = db.getSiblingDB('$PROJECT_DB_NAME').$PROJECT_TEMPLATES_COLLECTION.updateOne(
        {_id: ObjectId($PROJECT_TEMPLATE_ID_2)},
        { 
            \$set: { 
                'solutionId': ObjectId($SOLUTION_ID_2)
            },
            \$push: {
                'tasks': ObjectId($PROJECT_TEMPLATE_TASK_ID_2)
            }
        }
    );
    if (updateResult.matchedCount > 0) {
        print('Document updated successfully for ID: $PROJECT_TEMPLATE_ID_2');  // Output the specific ID
    } else {
        throw new Error('Update failed for ID: $PROJECT_TEMPLATE_ID_2');
    }"


docker exec project_mongo_1 mongo --host "$MONGO_HOST" --port "$MONGO_PORT" --quiet --eval "
    var updateResult = db.getSiblingDB('$PROJECT_DB_NAME').$PROJECT_TEMPLATES_COLLECTION.updateOne(
        {_id: ObjectId($PROJECT_TEMPLATE_ID_3)},
        { 
            \$set: { 
                'solutionId': ObjectId($SOLUTION_ID_3)
            },
            \$push: {
                'tasks': ObjectId($PROJECT_TEMPLATE_TASK_ID_3)
            }
        }
    );
    if (updateResult.matchedCount > 0) {
        print('Document updated successfully for ID: $PROJECT_TEMPLATE_ID_3');  // Output the specific ID
    } else {
        throw new Error('Update failed for ID: $PROJECT_TEMPLATE_ID_3');
    }"


# FORM_DOCUMENTS=$(cat <<EOF
# [{
#     "version" : 13,
#     "deleted" : false,
#     "type" : "homelist",
#     "subType" : "homelists",
#     "data" : [ 
#         {
#             "type" : "bannerList",
#             "listingData" : [ 
#                 {
#                     "title" : "Hey, Welcome back!",
#                     "discription" : ""
#                 }
#             ]
#         }, 
#         {
#             "type" : "solutionList",
#             "listingData" : [ 
#                 {
#                     "name" : "Projects",
#                     "img" : "assets/images/ic_project.svg",
#                     "redirectionUrl" : "/listing/project",
#                     "listType" : "project",
#                     "solutionType" : "improvementProject",
#                     "reportPage" : false,
#                     "description" : "Manage and track your school improvement easily, by creating tasks and planning project timelines"
#                 }, 
#                 {
#                     "name" : "Survey",
#                     "img" : "assets/images/ic_survey.svg",
#                     "redirectionUrl" : "/listing/survey",
#                     "listType" : "survey",
#                     "solutionType" : "survey",
#                     "reportPage" : false,
#                     "reportIdentifier" : "surveyReportPage",
#                     "description" : "Provide information and feedback through quick and easy surveys"
#                 }, 
#                 {
#                     "name" : "Reports",
#                     "img" : "assets/images/ic_report.svg",
#                     "redirectionUrl" : "/project-report",
#                     "listType" : "report",
#                     "reportPage" : true,
#                     "description" : "Make sense of data to enable your decision-making based on your programs with ease",
#                     "list" : [ 
#                         {
#                             "name" : "Improvement Project Reports",
#                             "img" : "assets/images/ic_project.svg",
#                             "redirectionUrl" : "/project-report",
#                             "listType" : "project",
#                             "solutionType" : "improvementProject",
#                             "reportPage" : false,
#                             "description" : "Manage and track your school improvement easily, by creating tasks and planning project timelines"
#                         }, 
#                         {
#                             "name" : "Survey Reports",
#                             "img" : "assets/images/ic_survey.svg",
#                             "redirectionUrl" : "/listing/survey",
#                             "listType" : "survey",
#                             "solutionType" : "survey",
#                             "reportPage" : true,
#                             "reportIdentifier" : "surveyReportPage",
#                             "description" : "Provide information and feedback through quick and easy surveys"
#                         }
#                     ]
#                 }, 
#                 {
#                     "name" : "Library",
#                     "img" : "assets/images/library.svg",
#                     "redirectionUrl" : "/project-library",
#                     "listType" : "library",
#                     "description" : ""
#                 }
#             ]
#         }
#     ],
#     "organizationId" : 1,
#     "updatedAt" : "2024-06-05T08:47:14.987Z",
#     "createdAt" : "2024-06-05T08:47:14.987Z",
#     "__v" : 0
# },
# {
#     "version" : 28,
#     "deleted" : false,
#     "type" : "form",
#     "subType" : "formFields",
#     "data" : [ 
#         {
#             "name" : "name",
#             "label" : "Enter your name",
#             "value" : "",
#             "type" : "text",
#             "placeHolder" : "Ex. Enter your name",
#             "errorMessage" : {
#                 "required" : "Enter your name",
#                 "pattern" : "This field can only contain alphabets"
#             },
#             "validators" : {
#                 "required" : true,
#                 "pattern" : "^[a-zA-Z\\s]*$"
#             },
#             "disable" : "false"
#         }, 
#         {
#             "name" : "state",
#             "label" : "Select your state",
#             "placeHolder" : "Select your state",
#             "value" : "",
#             "type" : "select",
#             "errorMessage" : {
#                 "required" : "Please select your state"
#             },
#             "validators" : {
#                 "required" : true
#             },
#             "dynamicEntity" : true,
#             "options" : [],
#             "disable" : "false"
#         }, 
#         {
#             "name" : "roles",
#             "label" : "Choose your role",
#             "value" : "",
#             "type" : "chip",
#             "dynamicUrl" : "/entity-management/v1/entities/targetedRoles/",
#             "errorMessage" : {
#                 "required" : "Select a role"
#             },
#             "validators" : {
#                 "required" : true
#             },
#             "options" : [],
#             "dependsOn" : "state",
#             "multiple" : true,
#             "disable" : "false"
#         }
#     ],
#     "organizationId" : 1,
#     "updatedAt" : "2024-06-25T10:08:58.689Z",
#     "createdAt" : "2024-06-25T10:08:58.689Z",
#     "__v" : 0
# },
# {
#     "version": 0,
#     "deleted": false,
#     "type": "KR001",
#     "subType": "KR001",
#     "data": [
#         {
#             "name": "district",
#             "label": "Select your district",
#             "placeHolder": "Select your district",
#             "value": "",
#             "type": "select",
#             "errorMessage": {
#                 "required": "Please select your district"
#             },
#             "validators": {
#                 "required": true
#             },
#             "options": [],
#             "dependsOn": "state",
#             "disable": "false"
#         }
#     ],
#     "organizationId": 1,
#     "updatedAt": "2024-08-23T11:32:06.172Z",
#     "createdAt": "2024-08-23T11:32:06.172Z",
#     "__v": 0
# }]
# EOF
# )

# echo "Forms data being added to forms collection in $PROJECT_DB_NAME database...."
# # Insert FORM using docker exec
# FORM_ID=$(docker exec -it project_mongo_1 mongo --host "$MONGO_HOST" --port "$MONGO_PORT" --quiet --eval "
#     var doc = $FORM_DOCUMENTS;
#     var result = db.getSiblingDB('$PROJECT_DB_NAME').forms.insertMany(doc);
#     if (result.insertedId) {
#         print(result.insertedId);
#     } else {
#         throw new Error('Insert failed');
#     }
# ")


CONFIGURATIONS_COLLECTION="configurations"

CONFIGURATIONS_DOCUMENT=$(cat <<EOF
{
    "code" : "keysAllowedForTargeting",
    "meta" : {
        "profileKeys" : [
            "state", "district", "school", "block", "cluster",
            "board", "class", "roles", "entities", "entityTypeId",
            "entityType", "subject", "medium"
        ]
    }
}
EOF
)

USER_EXTENSION_DOCUMENT=$(cat <<EOF
{
    "status" : "ACTIVE",
    "createdBy" : "SYSTEM",
    "updatedBy" : "SYSTEM",
    "deleted" : false,
    "userRoleId" : "8",
    "title" : "State Education Officer",
    "entityTypes" : [ 
        {
            "entityType" : "state",
            "entityTypeId" : $ENTITY_TYPE_ID,
        }
    ],
    "updatedAt" : "2024-09-09T09:31:47.135Z",
    "createdAt" : "2024-09-09T09:31:47.135Z",
    "__v" : 0
}
EOF
)

echo "user data being added to userRoleExtension collection in $ENTITY_SERVICE_DB_NAME database...."
# Insert SOLUTION_ID using docker exec
USER_EXTENSION_ID=$(docker exec -it project_mongo_1 mongo --host "$MONGO_HOST" --port "$MONGO_PORT" --quiet --eval "
    var doc = $USER_EXTENSION_DOCUMENT;
    var result = db.getSiblingDB('$ENTITY_SERVICE_DB_NAME').userRoleExtension.insertOne(doc);
    if (result.insertedId) {
        print(result.insertedId);
    } else {
        throw new Error('Insert failed');
    }
")

USER_EXTENSION_ID=$(clean_object_id "$USER_EXTENSION_ID")
echo "UserExtention ID: $USER_EXTENSION_ID"

echo "Configurations data being added to $CONFIGURATIONS_COLLECTION collection in $PROJECT_DB_NAME database...."

# Insert CONFIGURATION_ID using docker exec
CONFIGURATION_ID=$(docker exec -it project_mongo_1 mongo --host "$MONGO_HOST" --port "$MONGO_PORT" --quiet --eval "
    var doc = $CONFIGURATIONS_DOCUMENT;
    var result = db.getSiblingDB('$PROJECT_DB_NAME').$CONFIGURATIONS_COLLECTION.insertOne(doc);
    if (result.insertedId) {
        print(result.insertedId);
    } else {
        throw new Error('Insert failed');
    }
")


CONFIGURATION_ID=$(clean_object_id "$CONFIGURATION_ID")
echo "Configurations ID: $CONFIGURATION_ID"
const { exec } = require("../helpers/db");
const Math = require("mathjs");

let data;
let generatedClass;

const getRoomDetails = (rooms) => {
	return rooms.reduce(
		(details, room) => {
			details.capacityMap[room.room_num] = room.room_capacity;
			details.typeMap[room.room_num] = room.room_type;
			return details;
		},
		{ capacityMap: {}, typeMap: {}, numRooms: rooms.length },
	);
};

const getBatchDetails = (batches) => {
	return batches.reduce(
		(details, batch) => {
			details.courseMap[batch.batch_code] = batch.course_id;
			details.yearSemesterMap[batch.batch_code] = [batch.year, batch.semester];
			details.batchSizeMap[batch.batch_code] = batch.batch_size;
			details.idCodeMap[batch.batch_id] = batch.batch_code;
			return details;
		},
		{
			courseMap: {},
			yearSemesterMap: {},
			batchSizeMap: {},
			idCodeMap: {},
			numBatches: batches.length,
		},
	);
};

const getLecturerDetails = (lecturers) => {
	return lecturers.reduce(
		(details, lecturer) => {
			details.staffNumMap[lecturer.lecturer_id] = lecturer.staff_no;
			details.daysMap[lecturer.staff_no] = lecturer.preferred_days.split(", ");
			details.departmentMap[lecturer.staff_no] = lecturer.department_id;
			return details;
		},
		{
			daysMap: {},
			departmentMap: {},
			staffNumMap: {},
			numLecturers: lecturers.length,
		},
	);
};

const getCourseDetails = (courses) => {
	return courses.reduce(
		(details, course) => {
			details.departmentMap[course.course_id] = course.department_id;
			return details;
		},
		{ departmentMap: {} },
	);
};

const getSubjectDetails = (subjects) => {
	return subjects.reduce(
		(details, subject) => {
			details.subjectMap[subject.subject_id] = subject.subject_code;
			details.courseMap[subject.subject_code] = subject.course_id;
			details.labMap[subject.subject_code] = subject.has_lab ? true : false;
			return details;
		},
		{ subjectMap: {}, courseMap: {}, labMap: {}, numSubjects: subjects.length },
	);
};

const getBatchSubjects = (batchsubjects, batchMap) => {
	return batchsubjects.reduce((map, batchsubject) => {
		const batchCode = batchMap[batchsubject.batch_id];
		if (!map[batchCode]) {
			map[batchCode] = [];
		}
		map[batchCode].push(batchsubject.subject_id);
		return map;
	}, {});
};

module.exports = {
	generateAndAddClass: async (req, res) => {
		try {
			const [rooms_response] = await exec("CALL sp_get_all_rooms");
			const [lecturer_response] = await exec("CALL sp_get_all_lecturers");
			const [batch_response] = await exec("CALL sp_get_all_batches");
			const [subject_response] = await exec("CALL sp_get_all_subjects");
			const [batch_subject_response] = await exec(
				"CALL sp_get_all_batch_subject",
			);
			const [course_response] = await exec("CALL sp_get_all_courses");

			const {
				capacityMap: roomCapacity,
				typeMap: roomType,
				numRooms,
			} = getRoomDetails(rooms_response);

			const {
				staffNumMap: lecturerStaffNum,
				daysMap: lecturerDays,
				departmentMap: lecturerDepartment,
				numLecturers,
			} = getLecturerDetails(lecturer_response);

			const {
				courseMap: batchCourse,
				yearSemesterMap: batchYearSemester,
				batchSizeMap,
				numBatches,
				idCodeMap,
			} = getBatchDetails(batch_response);

			const {
				subjectMap: classSubject,
				courseMap: subjectCourse,
				labMap: subjectLab,
				numSubjects,
			} = getSubjectDetails(subject_response);

			const { departmentMap: courseDepartment } =
				getCourseDetails(course_response);

			const batchSubjects = getBatchSubjects(batch_subject_response, idCodeMap);

			data = {
				numClasses: 12,
				numRooms,
				numLecturers,
				numBatches,
				batchSizeMap,
				roomCapacity,
				roomType,
				classSubject,
				subjectCourse,
				courseDepartment,
				subjectLab,
				lecturerDepartment,
				lecturerDays,
				batchCourse,
				batchYearSemester,
				batchSubjects,
				lecturerStaffNum,
			};

			let totalSlots = 0;
			for (let batchCode in data.batchSizeMap) {
				const subjects = data.batchSubjects[batchCode];
				for (let subjectId of subjects) {
					const subjectCode = data.classSubject[subjectId];
					const hasLab = data.subjectLab[subjectCode];
					totalSlots += hasLab ? 2 : 1;
				}
			}

			data.numClasses = totalSlots;

			const rooms = generateMain(data);

			// Loop through the generated classes and add each one to the database
			for (let generatedClass of rooms) {
				const {
					staffno,
					subjectCode,
					roomNum,
					batchCode,
					startTime,
					endTime,
					dayOfWeek,
				} = generatedClass;

				const created_date = new Date().toISOString().split("T")[0];
				await exec("CALL sp_upsert_class(?,?,?,?,?,?,?,?)", [
					staffno,
					subjectCode,
					roomNum,
					batchCode,
					startTime,
					endTime,
					dayOfWeek,
					created_date,
				]);
			}
			res.status(200).json({
				status: 200,
				success: true,
				message: rooms,
			});
		} catch (error) {
			console.log(error.message);
			res.status(500).json({
				status: 500,
				success: false,
				message: error.message,
			});
		}
	},

	getClasses: async (req, res) => {
		try {
			const [response] = await exec("CALL sp_get_all_classes");
			return res.status(200).json({
				status: 200,
				success: true,
				data: response,
			});
		} catch (error) {
			console.log(error.message);
			res.status(500).json({
				status: 500,
				success: false,
				message: error.message,
			});
		}
	},
};

const options = {
	size: 100,
	crossover: 0.9,
	mutation: 0.1,
	iterations: 100,
	optimize: "maximize",
	select1: "roulette",
	select2: "roulette",
};

const generateMain = (data) => {
	const population = [];

	for (let i = 0; i < options.size; i++) {
		const solution = seed();
		const improvedSolution = localSearch(solution, data);
		population.push(improvedSolution);
	}

	let bestSolution = null;
	let bestFitness = null;

	for (let i = 0; i < options.iterations; i++) {
		const fitnessScores = [];

		for (let j = 0; j < population.length; j++) {
			const fitnessScore = fitness(population[j], data);
			fitnessScores.push(fitnessScore);

			bestSolution =
				bestSolution === null ||
				(options.optimize === "maximize" && fitnessScore > bestFitness) ||
				(options.optimize === "minimize" && fitnessScore < bestFitness)
					? population[j]
					: bestSolution;
			bestFitness = bestSolution === population[j] ? fitnessScore : bestFitness;
		}

		const parents = selection(population, fitnessScores);

		const offspring = crossoverAll(parents);

		// for (let j = 0; j < offspring.length; j++) {
		// 	const mutatedOffspring = mutation(offspring[j]);
		// 	const improvedOffspring = localSearch(mutatedOffspring, data);
		// 	population[j] = improvedOffspring;
		// }
	}

	generatedClass = bestSolution;
	console.log(bestFitness);

	return generatedClass;
};

const seed = function () {
	const solution = [];
	let classId = 1;

	for (let batchCode in data.batchSizeMap) {
		const subjects = data.batchSubjects[batchCode];

		for (let subjectId of subjects) {
			const subjectCode = data.classSubject[subjectId];
			const hasLab = data.subjectLab[subjectCode];
			const subjectCourse = data.subjectCourse[subjectCode];
			const subjectDept = data.courseDepartment[subjectCourse];

			const staffno = assignLecturer(subjectDept, data.lecturerDepartment);

			const preferredDays = data.lecturerDays[staffno];

			const classDay = preferredDays[Math.floor(Math.random() * 5)];

			const roomNum = allocateRoom(
				batchCode,
				data.roomCapacity,
				data.batchSizeMap,
				data.roomType,
				hasLab,
			);

			let startHour;

			do {
				startHour = Math.floor(Math.random() * 9) + 8;
			} while (startHour === 12);

			const startTime = `${startHour}:00:00`;

			// Schedule the class for the subject
			const classObj = {
				classId: classId++,
				staffno: staffno,
				subjectCode: subjectCode,
				roomNum: roomNum.classroom,
				batchCode: batchCode,
				startTime: startTime,
				endTime: `${startHour + 2}:00:00`, // Class duration is 2 hours
				dayOfWeek: classDay,
			};

			solution.push(classObj);

			// Schedule an additional lab for the subject if it has a lab
			if (hasLab) {
				const labObj = {
					classId: classId++,
					staffno: staffno,
					subjectCode: subjectCode,
					roomNum: roomNum.laboratory,
					batchCode: batchCode,
					startTime: startTime,
					endTime: `${startHour + 3}:00:00`, // Lab duration is 3 hours
					dayOfWeek: classDay,
				};

				solution.push(labObj);
			}
		}
	}

	return solution;
};

const getRandomDay = function () {
	const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
	return days[Math.floor(Math.random() * 5)];
};

const assignLecturer = function (subjectDept, lecturerDepartment) {
	const staffNumbers = Object.keys(lecturerDepartment);
	const suitableStaffNumbers = staffNumbers.filter(
		(staffNum) => lecturerDepartment[staffNum] === subjectDept,
	);
	const staffnum =
		suitableStaffNumbers[
			Math.floor(Math.random() * suitableStaffNumbers.length)
		];
	return staffnum;
};

const getRandomBatchCode = function (batchCourse) {
	const batchCodes = Object.keys(batchCourse);
	return batchCodes[Math.floor(Math.random() * batchCodes.length)];
};

const getRandomSubjectCode = function (subjectCourse) {
	const subjectCodes = Object.keys(subjectCourse);
	return subjectCodes[Math.floor(Math.random() * subjectCodes.length)];
};

/**
 * Allocates a room for a batch of students.
 *
 * @param {string} batchcode - The code of the batch.
 * @param {Object} roomCapacity - An object mapping room numbers to their capacities.
 * @param {Object} batchSizeMap - An object mapping batch codes to their sizes.
 * @param {Object} roomType - An object mapping room numbers to their types.
 * @param {boolean} hasLab - A boolean indicating whether the subject has a lab.
 * @returns {string} The number of the allocated room.
 */
const allocateRoom = function (
	batchcode,
	roomCapacity,
	batchSizeMap,
	roomType,
	hasLab,
) {
	const batchSize = batchSizeMap[batchcode];

	let suitableClassRooms = Object.keys(roomCapacity).filter(
		(roomNum) =>
			roomCapacity[roomNum] >= batchSize && roomType[roomNum] === "Classroom",
	);

	let suitableLabRooms = Object.keys(roomCapacity).filter(
		(roomNum) =>
			roomCapacity[roomNum] >= batchSize && roomType[roomNum] === "Laboratory",
	);

	if (suitableClassRooms.length === 0) {
		const roomCapacities = Object.values(roomCapacity).sort((a, b) => a - b);
		const closestCapacity = roomCapacities.find(
			(capacity) => capacity >= batchSize,
		);
		suitableClassRooms = Object.keys(roomCapacity).filter(
			(roomNum) =>
				roomCapacity[roomNum] === closestCapacity &&
				roomType[roomNum] === "Classroom",
		);
	}

	if (hasLab && suitableLabRooms.length === 0) {
		const roomCapacities = Object.values(roomCapacity).sort((a, b) => a - b);
		const closestCapacity = roomCapacities.find(
			(capacity) => capacity >= batchSize,
		);
		suitableLabRooms = Object.keys(roomCapacity).filter(
			(roomNum) =>
				roomCapacity[roomNum] === closestCapacity &&
				roomType[roomNum] === "Laboratory",
		);
	}

	let assignedRooms = {};
	if (hasLab) {
		assignedRooms = {
			classroom:
				suitableClassRooms[
					Math.floor(Math.random() * suitableClassRooms.length)
				],
			laboratory:
				suitableLabRooms[Math.floor(Math.random() * suitableLabRooms.length)],
		};
	} else {
		assignedRooms = {
			classroom:
				suitableClassRooms[
					Math.floor(Math.random() * suitableClassRooms.length)
				],
		};
	}

	return assignedRooms;
};

const isClassValid = function (classObj, data) {
	const lecturerUnavailableTimes = getLecturerUnavailableTimes(
		classObj.staffno,
		data,
	);

	if (
		lecturerUnavailableTimes.includes(classObj.dayOfWeek) &&
		isTimeBetween(
			classObj.startTime,
			classObj.endTime,
			lecturerUnavailableTimes,
		)
	) {
		return false;
	}
	if (
		data.roomCapacity[classObj.roomNum] < data.batchSizeMap[classObj.batchCode]
	) {
		return false;
	}

	return true;
};

const getLecturerUnavailableTimes = function (staffno, data) {
	return data.lecturerDays[staffno] || [];
};

const isOverlapping = function (start1, end1, start2, end2) {
	return (
		(start1 <= start2 && end1 >= start2) ||
		(start1 <= end2 && end1 >= end2) ||
		(start1 >= start2 && end1 <= end2)
	);
};

const isTimeBetween = function (startTime, endTime, unavailableTimes) {
	return unavailableTimes.every(
		(unavailableTime) =>
			!isOverlapping(
				startTime,
				endTime,
				unavailableTime.start,
				unavailableTime.end,
			),
	);
};

const fitness = function (solution, data) {
	let score = 0;

	for (let i = 0; i < solution.length; i++) {
		const classObj = solution[i];
		const staffno = classObj.staffno;

		const preferredDays = data.lecturerDays[staffno] || [];
		if (preferredDays.includes(classObj.dayOfWeek)) {
			score += 50;
		}

		if (!isClassValid(classObj, data)) {
			score -= 1000;
		}
	}

	return score;
};

const selection = function (population, fitnessScores) {
	const parents = [];
	for (let i = 0; i < options.size; i++) {
		const parent1 = roulette(population, fitnessScores);
		const parent2 = roulette(population, fitnessScores);
		parents.push(parent1, parent2);
	}
	return parents;
};

const crossoverAll = function (parents) {
	const offspring = [];
	for (let j = 0; j < parents.length; j += 2) {
		if (parents[j] && parents[j + 1]) {
			const children = crossover(parents[j], parents[j + 1]);
			offspring.push(...children);
		}
	}
	return offspring;
};
const crossover = function (parent1, parent2) {
	const offspring = [];
	for (let i = 0; i < data.numClasses; i++) {
		const rand = Math.random();
		if (rand < options.crossover) {
			const point1 = Math.floor(Math.random() * data.numClasses);
			const point2 = Math.floor(Math.random() * data.numClasses);
			const start = Math.min(point1, point2);
			const end = Math.max(point1, point2);
			if (parent1 && parent2) {
				const child1 = parent1
					.slice(0, start)
					.concat(parent2.slice(start, end), parent1.slice(end));
				const child2 = parent2
					.slice(0, start)
					.concat(parent1.slice(start, end), parent2.slice(end));
				offspring.push(child1, child2);
			}
		} else {
			if (parent1 && parent2) {
				offspring.push(parent1, parent2);
			}
		}
	}
	return offspring;
};

const mutation = function (solution) {
	for (let i = 0; i < data.numClasses; i++) {
		const rand = Math.random();
		if (rand < options.mutation) {
			const attributes = [
				"classId",
				"staffno",
				"subjectCode",
				"roomNum",
				"batchCode",
				"startTime",
				"endTime",
				"dayOfWeek",
			];
			const attribute =
				attributes[Math.floor(Math.random() * attributes.length)];
			let startHour;

			switch (attribute) {
				case "classId":
					solution[i].classId = Math.floor(Math.random() * data.numClasses) + 1;
					break;
				case "roomNum":
					solution[i].roomNum = allocateRoom(
						solution[i].batchCode,
						data.roomCapacity,
						data.batchSizeMap,
						data.roomType,
						data.subjectLab[
							data.classSubject[data.batchSubjects[solution[i].batchCode]]
						],
					);
					break;
				case "staffno":
					solution[i].staffno = assignLecturer(
						data.courseDepartment[data.subjectCourse[solution[i].subjectCode]],
						data.lecturerDepartment,
					);
					break;
				case "batchCode":
					solution[i].batchCode = getRandomBatchCode(data.batchCourse);
					break;
				case "subjectCode":
					solution[i].subjectCode = getRandomSubjectCode(data.subjectCourse);
					break;
				case "startTime":
					do {
						startHour = Math.floor(Math.random() * 9) + 8;
					} while (startHour === 12);
					solution[i].startTime = `${startHour}:00:00`;
					const classDuration = data.subjectLab[
						data.classSubject[solution[i].classId]
					]
						? 3
						: 2;
					const endHour = startHour + classDuration;
					solution[i].endTime = `${endHour}:00:00`;
					break;
				case "dayOfWeek":
					solution[i].dayOfWeek = getRandomDay();
					break;
			}
		}
	}
	return solution;
};

const roulette = function (population, fitnessScores) {
	const totalFitness = Math.sum(fitnessScores);
	const rand = Math.random() * totalFitness;
	let cumFitness = 0;

	for (let i = 0; i < population.length; i++) {
		cumFitness += fitnessScores[i];
		if (cumFitness >= rand) {
			return population[i];
		}
	}
};

const localSearch = function (solution, data) {
	// Check and resolve collisions
	for (let i = 0; i < solution.length; i++) {
		let conflicts = checkForCollisions(solution[i], solution);
		while (conflicts.length > 0) {
			for (let conflict of conflicts) {
				// Resolve room collisions
				if (conflict.type === "room") {
					const newRoom = allocateNewRoom(solution[i], data);
					if (newRoom !== undefined) {
						solution[i].roomNum = newRoom;
					} else {
						console.error(
							"allocateNewRoom returned undefined for",
							solution[i],
						);
						return; // or handle this case as needed
					}
				}
				// Resolve lecturer collisions
				if (conflict.type === "lecturer") {
					const newLecturer = assignNewLecturer(solution[i], data);
					if (newLecturer !== undefined) {
						solution[i].staffno = newLecturer;
					} else {
						console.error(
							"assignNewLecturer returned undefined for",
							solution[i],
						);
						return; // or handle this case as needed
					}
				}
				// Resolve batch collisions
				if (conflict.type === "batch") {
					const newTimeSlot = reassignBatchTimeSlot(solution[i], data);
					if (newTimeSlot !== undefined) {
						// Assuming reassignBatchTimeSlot returns a time slot object
						solution[i].startTime = newTimeSlot.startTime;
						solution[i].endTime = newTimeSlot.endTime;
					} else {
						console.error(
							"reassignBatchTimeSlot returned undefined for",
							solution[i],
						);
						return; // or handle this case as needed
					}
				}
			}
			// If still unresolved, attempt to resolve time conflicts
			if (
				!resolveCollision(
					conflicts.map((c) => c.conflictingClass),
					data,
				)
			) {
				// If conflicts are still unresolved after trying to resolve, change day
				const newDay = findFreeDay(solution[i], solution);
				if (newDay !== null) {
					// Assuming findFreeDay returns null when no day is free
					solution[i].dayOfWeek = newDay;
				} else {
					console.error("findFreeDay returned null for", solution[i]);
					return; // or handle this case as needed
				}
			}
			conflicts = checkForCollisions(solution[i], solution);
		}
	}
	return solution;
};

const allocateNewRoom = (classObj, data) => {
	// Iterate through all rooms and check if any is free at the desired time
	for (let roomNum in data.rooms) {
		let isRoomFree = data.rooms[roomNum].every((scheduledClass) => {
			return (
				scheduledClass.dayOfWeek !== classObj.dayOfWeek ||
				scheduledClass.endTime <= classObj.startTime ||
				scheduledClass.startTime >= classObj.endTime
			);
		});
		if (isRoomFree) {
			return roomNum; // Return the first free room number
		}
	}
	// If no rooms are free, return null or handle as needed
	return null;
};

const assignNewLecturer = (classObj, data) => {
	// Iterate through all lecturers and check if any is free at the desired time
	for (let staffno in data.lecturers) {
		let isLecturerFree = data.lecturers[staffno].every((scheduledClass) => {
			return (
				scheduledClass.dayOfWeek !== classObj.dayOfWeek ||
				scheduledClass.endTime <= classObj.startTime ||
				scheduledClass.startTime >= classObj.endTime
			);
		});
		if (isLecturerFree) {
			return staffno; // Return the first free lecturer number
		}
	}
	// If no lecturers are free, return null or handle as needed
	return null;
};

const findFreeDay = (classObj, solution) => {
	const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]; // Example days
	const preferredDays = data.lecturerDays[classObj.staffno];

	for (let day of daysOfWeek) {
		let isDayFree = solution.every((scheduledClass) => {
			return (
				scheduledClass.classId !== classObj.classId &&
				(scheduledClass.dayOfWeek !== day ||
					scheduledClass.endTime <= classObj.startTime ||
					scheduledClass.startTime >= classObj.endTime)
			);
		});
		if (isDayFree) {
			return day; // Return the first free day of the week
		}
	}
	// If no days are free, return null or handle as needed
	return null;
};

const reassignBatchTimeSlot = (classObj, data) => {
	// Assume class duration is constant, e.g., 2 hours for regular classes, 3 hours for labs
	const classDuration = data.subjectLab[classObj.subjectCode] ? 3 : 2;

	// Try to find a new time slot on the same day first
	let newStartTime = findNewStartTime(classObj, data, classDuration);
	if (newStartTime) {
		classObj.startTime = newStartTime;
		classObj.endTime = addHours(newStartTime, classDuration);
		return;
	}

	// If no time slot is available on the same day, look for another day
	// const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]; // Example days
	const preferredDays = data.lecturerDays[classObj.staffno];

	for (let day of preferredDays) {
		if (day !== classObj.dayOfWeek) {
			newStartTime = findNewStartTime(
				{ ...classObj, dayOfWeek: day },
				data,
				classDuration,
			);
			if (newStartTime) {
				classObj.dayOfWeek = day;
				classObj.startTime = newStartTime;
				classObj.endTime = addHours(newStartTime, classDuration);
				return;
			}
		}
	}

	// If no time slot is available at all, handle as needed (e.g., log an error)
};

const findNewStartTime = (classObj, data, duration) => {
	// Define start and end times for the school day
	const schoolDayStart = 8; // 8 AM
	const schoolDayEnd = 18; // 6 PM

	// Check each hour to see if it's free
	for (let hour = schoolDayStart; hour <= schoolDayEnd - duration; hour++) {
		let startTimeCandidate = `${hour}:00:00`;
		let endTimeCandidate = addHours(startTimeCandidate, duration);

		let isTimeSlotFree = data.classes.every((scheduledClass) => {
			return (
				scheduledClass.batchCode !== classObj.batchCode ||
				scheduledClass.dayOfWeek !== classObj.dayOfWeek ||
				scheduledClass.endTime <= startTimeCandidate ||
				scheduledClass.startTime >= endTimeCandidate
			);
		});

		if (isTimeSlotFree) {
			return startTimeCandidate; // Return the first free start time
		}
	}
	return null; // No free time slot found
};

const resolveCollision = (conflicts, data) => {
	// Assuming conflicts is an array of classes with a time conflict
	if (conflicts.length > 1) {
		// Attempt to reassign the second class in the conflicts array
		let classToReassign = conflicts[1];

		// Try to find a new time slot on the same day first
		let newStartTime = findNewStartTime(
			classToReassign,
			data,
			calculateDuration(classToReassign),
		);
		if (newStartTime) {
			classToReassign.startTime = newStartTime;
			classToReassign.endTime = addHours(
				newStartTime,
				calculateDuration(classToReassign),
			);
			return true; // Conflict resolved
		}

		// If no time slot is available on the same day, look for another day
		const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]; // Example days
		const preferredDays = data.lecturerDays[classToReassign.staffno];

		for (let day of preferredDays) {
			if (day !== classToReassign.dayOfWeek) {
				newStartTime = findNewStartTime(
					{ ...classToReassign, dayOfWeek: day },
					data,
					calculateDuration(classToReassign),
				);
				if (newStartTime) {
					classToReassign.dayOfWeek = day;
					classToReassign.startTime = newStartTime;
					classToReassign.endTime = addHours(
						newStartTime,
						calculateDuration(classToReassign),
					);
					return true; // Conflict resolved
				}
			}
		}
	}
	return false; // Conflict not resolved
};

const calculateDuration = (classObj) => {
	// Calculate duration based on start and end times
	let [startHours, startMinutes] = classObj.startTime.split(":").map(Number);
	let [endHours, endMinutes] = classObj.endTime.split(":").map(Number);
	return endHours - startHours + (endMinutes - startMinutes) / 60;
};

const addHours = (timeString, hoursToAdd) => {
	let [hours, minutes, seconds] = timeString.split(":").map(Number);
	hours += hoursToAdd;
	return `${hours}:${minutes}:${seconds}`;
};

const checkForCollisions = (classToCheck, solution) => {
	let conflicts = [];
	for (let i = 0; i < solution.length; i++) {
		if (solution[i].classId !== classToCheck.classId) {
			// Check for time conflict on the same day
			const isTimeConflict =
				solution[i].dayOfWeek === classToCheck.dayOfWeek &&
				((solution[i].startTime < classToCheck.endTime &&
					solution[i].endTime > classToCheck.startTime) ||
					(solution[i].endTime > classToCheck.startTime &&
						solution[i].startTime < classToCheck.endTime));

			// Check for same batch, lecturer, or room
			const isSameBatch = solution[i].batchCode === classToCheck.batchCode;
			const isSameLecturer = solution[i].staffno === classToCheck.staffno;
			const isSameRoom = solution[i].roomNum === classToCheck.roomNum;

			// If there is a time conflict and any of batch, lecturer, or room are the same, it's a collision
			if (isTimeConflict && (isSameBatch || isSameLecturer || isSameRoom)) {
				conflicts.push({
					conflictingClass: solution[i],
					type: isSameBatch ? "batch" : isSameLecturer ? "lecturer" : "room",
				});
			}
		}
	}
	console.log(conflicts);
	return conflicts;
};

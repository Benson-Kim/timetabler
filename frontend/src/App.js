import React, { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import Main from "./components/Main";
import "./App.css";

import {
	LoginPage,
	SettingsPage,
	HomePage,
	CoursesPage,
	LecturersPage,
	SubjectsPage,
	RoomsPage,
	DepartmentsPage,
	BatchesPage,
	ClassesPage,
} from "./pages";

import { getClasses } from "./api";

const App = () => {
	const [classes, setClasses] = useState([]);
	const fetchClasses = async () => {
		try {
			const classData = await getClasses();
			const transformedData = classData.data.map((schedule, index) => ({
				staffno: schedule.lecturer_staffno,
				subjectCode: schedule.subject_code,
				roomNum: schedule.room_num,
				batchCode: schedule.batch_code,
				startTime: schedule.start_time,
				endTime: schedule.end_time,
				dayOfWeek: schedule.day_of_week,
			}));

			setClasses(transformedData);
		} catch (error) {
			console.error("Error fetching classes:", error);
		}
	};

	useEffect(() => {
		fetchClasses();
	}, []);

	return (
		<div className="min-h-screen">
			<Routes>
				<Route path="/" element={<LoginPage />} />
				<Route path="/app" element={<Main />}>
					<Route index element={<Navigate to={"/app/home"} />} />
					<Route path="departments" element={<DepartmentsPage />} />
					<Route path="lecturers" element={<LecturersPage />} />
					<Route path="courses" element={<CoursesPage />} />
					<Route path="batches" element={<BatchesPage />} />
					<Route path="subjects" element={<SubjectsPage />} />
					<Route path="rooms" element={<RoomsPage />} />
					<Route path="settings" element={<SettingsPage />} />
					<Route path="home" element={<HomePage />} />
					<Route
						path="classes"
						element={<ClassesPage initialData={classes} />}
					/>
				</Route>
			</Routes>
		</div>
	);
};

export default App;

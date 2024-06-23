import React from "react";
import { MdGroup } from "react-icons/md";
import { Link } from "react-router-dom";
// import useLeaders from "../../hooks/useLeaders";
// import useAccountUsers from "../../hooks/useAccountUsers";

const Home = () => {
	// const { total: totalLeaders } = useLeaders();
	// const { total: totalMembers } = useAccountUsers();
	return (
		<div className="p-2 py-8">
			<div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
				<CountCard
					iconColor="text-orange-800"
					countColor="text-orange-500"
					icon={MdGroup}
					title="Departments"
					count={10}
				/>
				<CountCard
					iconColor="text-indigo-100"
					countColor="text-indigo-100"
					icon={MdGroup}
					title="Lecturers"
					count={32}
				/>
				<CountCard
					iconColor="text-indigo-100"
					countColor="text-indigo-100"
					icon={MdGroup}
					title="Batches"
					count={8}
				/>
				<CountCard
					iconColor="text-red-800"
					countColor="text-red-500"
					icon={MdGroup}
					title="Subjects"
					count={42}
				/>
			</div>

			<div className="my-5">
				<h2 className="text-xl font-bold uppercase opacity-75">Quick Links</h2>

				<div className="flex my-4 gap-4 flex-wrap">
					<div className="shadow inline-block px-5 py-2.5  bg-dark-green text-light-gray font-semibold rounded-sm">
						<Link to="/app/lecturers?action=new">
							<a>Add Lecturer</a>
						</Link>
					</div>
					<div className="shadow inline-block px-5 py-2.5  bg-dark-green text-light-gray font-semibold rounded-sm">
						<Link to="/app/courses?action=new">
							<a>Add Course</a>
						</Link>
					</div>
					<div className="shadow inline-block px-5 py-2.5  bg-dark-green text-light-gray font-semibold rounded-sm">
						<Link to="/app/departments?action=new">
							<a>Add Department</a>
						</Link>
					</div>
					<div className="shadow inline-block px-5 py-2.5  bg-dark-green text-light-gray font-semibold rounded-sm">
						<Link to="/app/batches?action=new">
							<a>Add Batch</a>
						</Link>
					</div>
					<div className="shadow inline-block px-5 py-2.5  bg-dark-green text-light-gray font-semibold rounded-sm">
						<Link to="/app/settings">
							<a>Settings</a>
						</Link>
					</div>
				</div>
			</div>
		</div>
	);
};

const CountCard = ({ iconColor, countColor, icon: Icon, title, count }) => (
	<div className="rounded-md bg-white shadow-md px-6 py-4 flex items-center space-x-4">
		<Icon
			className={`text-4xl my-2 ${iconColor ? iconColor : "text-indigo-800"}`}
		/>
		<div className="flex flex-col space-y-2">
			<h2 className="tracking-wider text-xl uppercase text-gray-600">
				{title}
			</h2>
			<span
				className={`${
					countColor ? countColor : "text-dark-orange"
				} tracking-wider font-bold text-2xl`}>
				{count}
			</span>
		</div>
	</div>
);

export default Home;

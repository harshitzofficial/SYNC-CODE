import { useRecoilValue } from "recoil";
import { userAtom } from "../atoms/userAtom";
import {  Navigate, useParams } from "react-router-dom";

const ProtectedRouter = ( {children} : {children : React.ReactNode}) => {
    const user = useRecoilValue(userAtom);

    const params = useParams();
    return (
        user.id != "" && user.roomId != "" ? children : <Navigate to={`/${params.roomId}`}/>
    )
};

export default ProtectedRouter;